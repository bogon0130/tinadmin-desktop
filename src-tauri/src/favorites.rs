//! 접속 즐겨찾기 저장소.
//!
//! 앱 설정 폴더의 favorites.json 하나에 트리 전체(폴더 + 항목)를 담는다.
//! 서버가 아니라 이 PC 에 둔다 — 즐겨찾기는 "이 사람이 자주 쓰는 접속"이라
//! 서버 설정(config/.env)과 성격이 다르고, 서버를 건드리지 않아야 안전하다.
//!
//! ★서버 주소/계정은 여기 저장하지 않는다★
//!   접속 순간에 서버 config(.env)에서 받아온다. 즐겨찾기에 IP 를 박아두면
//!   서버 주소가 바뀔 때 저장된 항목이 전부 낡은 값으로 남는다.

use std::fs;
use std::io::Write;
use std::path::PathBuf;

use tauri::Manager;

const FILE_NAME: &str = "favorites.json";

fn store_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_config_dir()
        .map_err(|e| format!("설정 폴더를 찾지 못했습니다: {}", e))?;
    fs::create_dir_all(&dir).map_err(|e| format!("설정 폴더를 만들지 못했습니다: {}", e))?;
    Ok(dir.join(FILE_NAME))
}

/// 즐겨찾기 파일 위치 (화면에 보여주기 위함).
#[tauri::command]
pub fn favorites_path(app: tauri::AppHandle) -> Result<String, String> {
    Ok(store_path(&app)?.to_string_lossy().to_string())
}

/// 저장된 JSON 을 그대로 돌려준다. 파일이 없으면 빈 문자열.
///
/// ★깨진 파일을 여기서 고치지 않는다★
///   JSON 해석은 화면 쪽에서 하고, 실패하면 빈 목록으로 시작하며 경고를 띄운다.
///   여기서 조용히 덮어써 버리면 사용자가 손으로 복구할 기회를 잃는다.
#[tauri::command]
pub fn favorites_load(app: tauri::AppHandle) -> Result<String, String> {
    let path = store_path(&app)?;
    if !path.is_file() {
        return Ok(String::new());
    }
    fs::read_to_string(&path).map_err(|e| format!("즐겨찾기를 읽지 못했습니다: {}", e))
}

/// JSON 을 저장한다. 저장 직전에 형식을 검사하고, 원자적으로 바꿔친다.
#[tauri::command]
pub fn favorites_save(app: tauri::AppHandle, json: String) -> Result<String, String> {
    if json.len() > 4 * 1024 * 1024 {
        return Err("즐겨찾기가 너무 큽니다.".into());
    }
    // 깨진 JSON 을 저장해서 다음 실행 때 목록을 통째로 잃는 일을 막는다.
    serde_json::from_str::<serde_json::Value>(&json)
        .map_err(|e| format!("즐겨찾기 형식이 올바르지 않아 저장하지 않았습니다: {}", e))?;

    let path = store_path(&app)?;

    // 손상 대비: 기존 파일을 .bak 으로 남긴다.
    if path.is_file() {
        let _ = fs::copy(&path, path.with_extension("json.bak"));
    }

    // 임시 파일에 다 쓴 뒤 이름을 바꾼다.
    // 쓰는 도중에 앱이 죽어도 원본이 반쯤 잘린 상태로 남지 않는다.
    let tmp = path.with_extension("json.tmp");
    {
        let mut f = fs::File::create(&tmp)
            .map_err(|e| format!("즐겨찾기를 쓰지 못했습니다: {}", e))?;
        f.write_all(json.as_bytes())
            .map_err(|e| format!("즐겨찾기를 쓰지 못했습니다: {}", e))?;
        f.sync_all().ok();
    }
    fs::rename(&tmp, &path).map_err(|e| format!("즐겨찾기를 저장하지 못했습니다: {}", e))?;

    log::info!("즐겨찾기 저장: {} ({} bytes)", path.display(), json.len());
    Ok(path.to_string_lossy().to_string())
}
