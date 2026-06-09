use base64::{engine::general_purpose, Engine as _};
use std::path::{Path, PathBuf};
use std::process::Command;

#[derive(serde::Serialize)]
struct FileInfo {
    file_name: String,
    file_size: u64,
}

fn ensure_pdf_path(file_path: &Path) -> Result<(), String> {
    if !file_path.is_file() {
        return Err("请选择有效的 PDF 文件。".into());
    }

    let is_pdf = file_path
        .extension()
        .and_then(|extension| extension.to_str())
        .map(|extension| extension.eq_ignore_ascii_case("pdf"))
        .unwrap_or(false);

    if !is_pdf {
        return Err("请选择 PDF 文件。".into());
    }

    Ok(())
}

#[tauri::command]
fn get_file_info(path: String) -> Result<FileInfo, String> {
    let file_path = PathBuf::from(&path);
    ensure_pdf_path(&file_path)?;

    let file_name = file_path
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| "无法解析文件名。".to_string())?
        .to_string();

    let metadata = std::fs::metadata(&file_path).map_err(|_| "获取文件大小失败。".to_string())?;

    Ok(FileInfo {
        file_name,
        file_size: metadata.len(),
    })
}

/// Detect if extracted text is likely garbled (mojibake).
/// Checks for high ratio of replacement chars or characters outside
/// common printable ranges (ASCII + CJK + common punctuation).
fn is_garbled_text(text: &str) -> bool {
    if text.is_empty() {
        return true;
    }

    let total = text.chars().count() as f64;
    if total < 10.0 {
        return false;
    }

    // Count replacement characters
    let replacement_count = text.chars().filter(|&c| c == '\u{FFFD}').count() as f64;
    if replacement_count / total > 0.05 {
        return true;
    }

    // Count characters that are outside typical printable ranges
    // Allow: ASCII (0x20-0x7E), CJK (0x4E00-0x9FFF, 0x3400-0x4DBF),
    // common punct (0x3000-0x303F), fullwidth (0xFF00-0xFFEF),
    // extended CJK (0x20000-0x2A6DF), newline/tab, etc.
    let bad_count = text.chars().filter(|&c| {
        let code = c as u32;
        !(code == 0x0A || code == 0x0D || code == 0x09        // newline, tab
            || (0x20..=0x7E).contains(&code)                   // ASCII printable
            || (0x4E00..=0x9FFF).contains(&code)               // CJK Unified
            || (0x3400..=0x4DBF).contains(&code)               // CJK Extension A
            || (0x3000..=0x303F).contains(&code)               // CJK Symbols & Punct
            || (0xFF00..=0xFFEF).contains(&code)               // Fullwidth forms
            || (0x20000..=0x2A6DF).contains(&code)             // CJK Extension B
            || (0x2100..=0x214F).contains(&code)               // Letterlike Symbols
            || (0xFE50..=0xFE6F).contains(&code)               // Small Form Variants
            || (0x00A1..=0x00FF).contains(&code)               // Latin-1 Supplement
            || (0x0370..=0x03FF).contains(&code)               // Greek & Coptic
            || (0x0400..=0x04FF).contains(&code)               // Cyrillic
            || (0x0600..=0x06FF).contains(&code)               // Arabic
            || (0x00B7 == code)                                // middle dot
            || (0x2010..=0x2027).contains(&code)               // General Punctuation
            || (0x2030..=0x205E).contains(&code)               // General Punctuation
            || (0x20AC == code)                                 // Euro sign
            || (0xFEFF == code)                                 // BOM
            || (0x200B..=0x200D).contains(&code)               // Zero-width spaces
            || (0x2060 == code)                                 // Word joiner
            || (0x00B0..=0x00B6).contains(&code)               // Degree, pilcrow etc
            || (0x2080..=0x20AF).contains(&code))              // Superscript/Subscript + Currency
    }).count() as f64;

    bad_count / total > 0.15
}

/// Try to extract text using pdftotext (from poppler) if available.
fn try_pdftotext(path: &Path) -> Option<String> {
    let output = Command::new("pdftotext")
        .arg("-layout")
        .arg("-nopgbrk")
        .arg(path.to_str()?)
        .arg("-")  // stdout
        .output()
        .ok()?;

    if !output.status.success() {
        return None;
    }

    let text = String::from_utf8(output.stdout).ok()?;
    let normalized = text
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .collect::<Vec<_>>()
        .join("\n");

    if normalized.chars().count() < 200 {
        return None;
    }

    Some(normalized)
}

#[tauri::command]
fn extract_pdf_text(file_path: String) -> Result<String, String> {
    let path = PathBuf::from(&file_path);
    ensure_pdf_path(&path)?;

    // Primary: use pdf-extract crate
    let text = pdf_extract::extract_text(&path).map_err(|error| {
        format!(
            "PDF 文本解析失败：{}。请确认该文件不是加密 PDF，且包含可提取的文本层。",
            error
        )
    })?;

    // Check for garbled output (common with CJK PDFs)
    if is_garbled_text(&text) {
        // Try pdftotext as fallback
        if let Some(fallback) = try_pdftotext(&path) {
            return Ok(fallback);
        }
        // If pdftotext also fails or isn't available, return what we have
        // but warn the user
        let normalized = text
            .lines()
            .map(str::trim)
            .filter(|line| !line.is_empty())
            .collect::<Vec<_>>()
            .join("\n");

        if normalized.chars().count() < 200 {
            return Err(
                "未能提取到有效文本（可能是编码问题或扫描版 PDF）。建议使用带文本层的 PDF，或安装 poppler (https://github.com/oschwartz10612/poppler-windows/releases) 以获得更好的中文解析支持。".into(),
            );
        }

        return Err(format!(
            "中文文本解析可能存在乱码（已提取 {} 字符）。建议安装 poppler 后重新导入以获得更好的中文支持。\n安装方法：1) 从 https://github.com/oschwartz10612/poppler-windows/releases 下载 bin 并加入 PATH；2) 或使用 Chocolatey: choco install poppler",
            normalized.chars().count()
        ));
    }

    let normalized = text
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .collect::<Vec<_>>()
        .join("\n");

    if normalized.chars().count() < 200 {
        return Err(
            "未能提取到有效文本，可能是扫描版 PDF。当前版本暂不支持 OCR，请使用带文本层的 PDF。"
                .into(),
        );
    }

    Ok(normalized)
}

#[tauri::command]
fn read_pdf_bytes(file_path: String) -> Result<String, String> {
    let path = PathBuf::from(&file_path);
    ensure_pdf_path(&path)?;

    let bytes = std::fs::read(&path).map_err(|error| format!("读取 PDF 文件失败：{}", error))?;

    Ok(general_purpose::STANDARD.encode(bytes))
}

#[tauri::command]
fn write_text_file(file_path: String, content: String) -> Result<(), String> {
    let path = PathBuf::from(&file_path);

    if file_path.trim().is_empty() {
        return Err("保存路径为空。".into());
    }

    if let Some(parent) = path.parent() {
        if !parent.exists() {
            return Err("保存目录不存在。".into());
        }
    }

    std::fs::write(&path, content).map_err(|error| format!("写入 Markdown 文件失败：{}", error))
}

#[tauri::command]
fn write_binary_file(file_path: String, bytes: Vec<u8>) -> Result<(), String> {
    let path = PathBuf::from(&file_path);

    if file_path.trim().is_empty() {
        return Err("保存路径为空。".into());
    }

    if let Some(parent) = path.parent() {
        if !parent.exists() {
            return Err("保存目录不存在。".into());
        }
    }

    std::fs::write(&path, bytes).map_err(|error| format!("写入 Word 文件失败：{}", error))
}

#[tauri::command]
fn store_api_key(service: String, key: String) -> Result<(), String> {
    match keyring::Entry::new("paperlens", &service) {
        Ok(entry) => entry.set_password(&key).map_err(|e| e.to_string()),
        Err(e) => Err(format!("无法访问系统钥匙串：{}", e)),
    }
}

#[tauri::command]
fn get_api_key(service: String) -> Result<String, String> {
    match keyring::Entry::new("paperlens", &service) {
        Ok(entry) => match entry.get_password() {
            Ok(pw) => Ok(pw),
            Err(keyring::Error::NoEntry) => Ok(String::new()),
            Err(e) => Err(format!("读取系统钥匙串失败：{}", e)),
        },
        Err(_) => Ok(String::new()),
    }
}

#[tauri::command]
fn delete_api_key(service: String) -> Result<(), String> {
    match keyring::Entry::new("paperlens", &service) {
        Ok(entry) => entry.delete_password().map_err(|e| e.to_string()),
        Err(e) => Err(format!("无法访问系统钥匙串：{}", e)),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            get_file_info,
            extract_pdf_text,
            read_pdf_bytes,
            write_text_file,
            write_binary_file,
            store_api_key,
            get_api_key,
            delete_api_key
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
