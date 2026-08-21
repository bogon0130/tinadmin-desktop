mod favorites;
mod launch;

use tauri::webview::PageLoadEvent;
use tauri_plugin_log::{Target, TargetKind};
use tauri_plugin_opener::OpenerExt;
fn external_navigation_plugin<R: tauri::Runtime>() -> tauri::plugin::TauriPlugin<R> {
    tauri::plugin::Builder::<R>::new("external-navigation")
        .on_navigation(|webview, url| {
            let is_internal_host = matches!(
                url.host_str(),
                Some("localhost") | Some("127.0.0.1") | Some("tauri.localhost") | Some("::1")
            );

            let is_internal = url.scheme() == "tauri" || is_internal_host;

            if is_internal {
                return true;
            }

            let is_external_link = matches!(url.scheme(), "http" | "https" | "mailto" | "tel");

            if is_external_link {
                log::info!("opening external link in system browser: {}", url);
                let _ = webview.opener().open_url(url.as_str(), None::<&str>);
                return false;
            }

            true
        })
        .build()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(
            tauri_plugin_log::Builder::new()
                .targets([
                    Target::new(TargetKind::Stdout),
                    Target::new(TargetKind::LogDir { file_name: None }),
                    Target::new(TargetKind::Webview),
                ])
                .build(),
        )
        .plugin(tauri_plugin_opener::init())
        .plugin(external_navigation_plugin())
        // ★2026-08-21: 미사용 커맨드 7개 삭제★ greet(템플릿 잔재),
        //   favorites_save/favorites_path, charnotes_*, groupnotes_* 를 걷어냈다.
        //   즐겨찾기와 메모가 서버 저장(/api/favorites, /api/notes/<key>)으로
        //   옮겨가면서 프론트가 부르지 않게 된 것들이다(호출 0건 확인 후 삭제).
        //   favorites_load 만 남긴 이유: 옛 버전에서 넘어온 사람의 로컬 즐겨찾기를
        //   서버로 한 번 올려주는 이전 경로(lib/favorites.ts migrateLocalToServer)가 쓴다.
        .invoke_handler(tauri::generate_handler![
            launch::open_terminal,
            favorites::favorites_load,
            favorites::textsnips_load,
            favorites::textsnips_save,
        ])
        .on_page_load(|webview, payload| {
            if webview.label() == "main" && matches!(payload.event(), PageLoadEvent::Finished) {
                log::info!("main webview finished loading");
                let _ = webview.window().show();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
