use std::path::{Path, PathBuf};

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

#[tauri::command]
fn extract_pdf_text(file_path: String) -> Result<String, String> {
    let path = PathBuf::from(&file_path);
    ensure_pdf_path(&path)?;

    let text = pdf_extract::extract_text(&path).map_err(|error| {
        format!(
            "PDF 文本解析失败：{}。请确认该文件不是加密 PDF，且包含可提取的文本层。",
            error
        )
    })?;

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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            get_file_info,
            extract_pdf_text,
            write_text_file,
            write_binary_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
