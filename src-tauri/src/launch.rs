//! 조합 접속 — 새 터미널 창을 띄워 ssh 로 붙는다.
//!
//! ★왜 shell 플러그인을 쓰지 않는가★
//!   tauri-plugin-shell 을 열면 웹뷰가 임의 명령을 실행할 수 있는 통로가 생긴다.
//!   여기서는 프론트가 "접속 대상"과 "원격 명령"만 넘기고, 실제 명령줄 조립과
//!   검증은 전부 이 파일(Rust)에서 한다. 웹뷰는 터미널 프로그램 이름조차 못 고른다.
//!
//! ★서버가 아니라 사용자 PC 에서 실행된다★
//!   ssh 를 서버에서 돌리면 그 리눅스가 자기 자신에게 접속하게 되고 돌아가는
//!   사냥 세션과 같은 화면을 건드릴 위험이 있다. 그래서 앱(클라이언트)이 띄운다.

use std::process::Command;

/// ssh 접속 대상 형식: 계정@호스트
fn valid_target(t: &str) -> bool {
    let ok_char = |c: char| c.is_ascii_alphanumeric() || matches!(c, '.' | '_' | '-');
    match t.split_once('@') {
        Some((user, host)) => {
            !user.is_empty()
                && !host.is_empty()
                && user.len() <= 64
                && host.len() <= 255
                && user.chars().all(ok_char)
                && host.chars().all(ok_char)
        }
        None => false,
    }
}

/// 원격 명령 검사.
///
/// 겹따옴표를 막는 이유: 명령을 ssh -t 대상 "여기" 형태로 감싸기 때문에,
/// 안에 겹따옴표가 있으면 거기서 문자열이 닫히고 뒤가 별개 인자로 새어나간다.
/// 개행/제어문자는 명령줄을 통째로 갈아끼우는 데 쓰일 수 있어 함께 막는다.
fn check_remote(r: &str) -> Result<(), String> {
    if r.trim().is_empty() {
        return Err("실행할 명령이 비어 있습니다.".into());
    }
    if r.len() > 1000 {
        return Err("실행할 명령이 너무 깁니다.".into());
    }
    if r.contains('"') {
        return Err("명령에 겹따옴표(\")는 쓸 수 없습니다.".into());
    }
    if let Some(c) = r.chars().find(|c| c.is_control()) {
        return Err(format!("명령에 제어문자(U+{:04X})가 있습니다.", c as u32));
    }
    Ok(())
}

/// 창 제목에서 따옴표/제어문자를 걷어낸다 (제목이 명령줄을 깨뜨리지 않게).
fn safe_title(t: &str) -> String {
    let s: String = t
        .chars()
        .filter(|c| !c.is_control() && *c != '"' && *c != '%' && *c != '&' && *c != '^')
        .take(60)
        .collect();
    if s.trim().is_empty() {
        "tinadmin".into()
    } else {
        s
    }
}

/// PowerShell 문자열 안에 넣기 위한 홑따옴표 이스케이프.
///
/// PowerShell 의 '작은따옴표 문자열' 안에서 작은따옴표는 두 번 써서 표현한다.
/// 그룹 접속 명령이 tmux 인자를 '홑따옴표'로 감싸고 있어서 이 처리가 반드시 필요하다.
pub fn ps_quote(s: &str) -> String {
    s.replace('\'', "''")
}

/// 윈도우 명령줄 조립 (cmd.exe 에 그대로 넘길 문자열).
///
///   /c start "제목" powershell -NoExit -Command "chcp 65001 > $null; ssh -t 대상 '원격명령'"
///
/// start       : 새 창을 띄운다. 첫 따옴표 토큰을 창 제목으로 먹으므로 반드시 준다.
/// powershell  : 요구대로 새 PowerShell 창에서 실행한다.
/// -NoExit     : ssh 가 끝나도 창을 닫지 않는다 — 접속이 실패해도 이유를 볼 수 있다.
///               keep_open=false 면 이 옵션을 빼서 명령이 끝나는 즉시 창이 닫힌다.
/// chcp 65001  : 한글이 깨지지 않게 UTF-8 코드페이지로 맞춘다.
///
/// ★keep_open 을 언제 끄는가★
///   "끊기(kill-session)" 처럼 결과를 볼 필요가 없고 순식간에 끝나는 명령이다.
///   접속처럼 실패할 수 있는 명령은 반드시 켜둔다 — 끄면 실패 메시지가 창과 함께
///   사라져서 왜 안 됐는지 알 방법이 없어진다.
///
/// ★따옴표 설계★
///   바깥(cmd)은 겹따옴표, 안쪽(PowerShell)은 홑따옴표만 쓴다.
///   원격 명령에는 겹따옴표가 못 들어오게 막아두었고(check_remote),
///   원래 들어있는 홑따옴표는 ps_quote 로 '' 로 바꾼다. 두 층이 겹치지 않는다.
pub fn build_windows_cmdline(
    target: &str,
    remote: &str,
    title: &str,
    keep_open: bool,
) -> Result<String, String> {
    if !valid_target(target) {
        return Err(format!("접속 대상 형식이 올바르지 않습니다: {}", target));
    }
    check_remote(remote)?;
    // 붙일 때 공백까지 함께 넣는다 — 빼면 "powershell-Command" 로 붙어버린다.
    let noexit = if keep_open { "-NoExit " } else { "" };
    Ok(format!(
        "/c start \"{}\" powershell {}-Command \"chcp 65001 > $null; ssh -t {} '{}'\"",
        safe_title(title),
        noexit,
        target,
        ps_quote(remote)
    ))
}

/// 리눅스/맥에서 쓸 (터미널프로그램, 인자들). 개발 중 확인용 경로다.
pub fn build_unix_argv(target: &str, remote: &str) -> Result<Vec<String>, String> {
    if !valid_target(target) {
        return Err(format!("접속 대상 형식이 올바르지 않습니다: {}", target));
    }
    check_remote(remote)?;
    Ok(vec![
        "ssh".into(),
        "-t".into(),
        target.into(),
        remote.into(),
    ])
}

/// 새 터미널 창을 띄워 접속한다. 성공하면 실제로 실행한 명령을 돌려준다.
///
/// keep_open : 명령이 끝난 뒤 창을 남길지. 기존 호출부(즐겨찾기·접속 빌더)는 true 를
///             넘겨 예전과 똑같이 동작한다. false 는 "끊기" 처럼 결과를 볼 필요가
///             없는 명령에만 쓴다.
///
/// ★rename_all = "snake_case" 를 준 이유★ Tauri 는 기본적으로 러스트의 snake_case
///   인자를 자바스크립트에서 camelCase(keepOpen)로 받는다. 이 프로젝트의 다른 인자는
///   전부 한 단어(target/remote/title)라 지금까지 차이가 드러나지 않았는데, keep_open
///   부터는 이름이 갈린다. 양쪽 표기를 맞춰 헷갈릴 여지를 없앤다.
#[tauri::command(rename_all = "snake_case")]
pub fn open_terminal(
    target: String,
    remote: String,
    title: String,
    keep_open: bool,
) -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        let line = build_windows_cmdline(&target, &remote, &title, keep_open)?;
        // raw_arg — 러스트 기본 인자 이스케이프와 cmd.exe 파싱 규칙이 달라서,
        // 명령줄을 우리가 만든 그대로 넘겨야 따옴표가 어긋나지 않는다.
        Command::new("cmd.exe")
            .raw_arg(&line)
            .spawn()
            .map_err(|e| format!("터미널을 띄우지 못했습니다: {}", e))?;
        log::info!("접속 터미널 실행: cmd.exe {}", line);
        return Ok(format!("cmd.exe {}", line));
    }

    #[cfg(not(target_os = "windows"))]
    {
        let argv = build_unix_argv(&target, &remote)?;
        // 흔한 터미널을 순서대로 시도한다 (없으면 다음 것).
        //
        // ★유닉스는 기본이 "명령 끝나면 창 닫힘" 이라 윈도우와 반대다★
        //   그래서 keep_open=false 는 아무것도 안 해도 되고, keep_open=true 일 때
        //   창을 붙잡는 옵션을 앞에 끼운다. 세 번째 칸이 그 옵션인데, 그 옵션을
        //   가진 터미널만 값이 있다 — gnome-terminal 은 --hold 를 없앴고
        //   x-terminal-emulator 는 무엇으로 연결됐는지에 따라 달라서 못 준다.
        //   (이 경로는 개발 중 확인용이라 그 두 개에서 창이 닫혀도 문제되지 않는다)
        let terms: [(&str, Vec<String>, Option<&str>); 4] = [
            ("x-terminal-emulator", vec!["-e".into()], None),
            ("gnome-terminal", vec!["--".into()], None),
            ("konsole", vec!["-e".into()], Some("--hold")),
            ("xterm", vec!["-e".into()], Some("-hold")),
        ];
        let _ = &title;
        for (prog, pre, hold) in terms.iter() {
            let mut c = Command::new(prog);
            if keep_open {
                if let Some(h) = hold {
                    c.arg(h);
                }
            }
            c.args(pre).args(&argv);
            match c.spawn() {
                Ok(_) => {
                    log::info!("접속 터미널 실행: {} {:?}", prog, argv);
                    return Ok(format!("{} {}", prog, argv.join(" ")));
                }
                Err(e) if e.kind() == std::io::ErrorKind::NotFound => continue,
                Err(e) => return Err(format!("터미널을 띄우지 못했습니다: {}", e)),
            }
        }
        Err("띄울 수 있는 터미널을 찾지 못했습니다.".into())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const T: &str = "kimbogon@192.168.219.157";
    const SOLO: &str = "cd /home/kimbogon/projects/goblin && tt++ tin/_combos/담신우조합.tin";
    const GROUP: &str = "tmux new-window -t goblin -n 담신우 'cd /home/kimbogon/projects/goblin && tt++ tin/_combos/담신우조합.tin' && tmux attach -t goblin";

    #[test]
    fn 단독_명령줄_조립() {
        let line = build_windows_cmdline(T, SOLO, "담신우 단독", true).unwrap();
        assert_eq!(
            line,
            "/c start \"담신우 단독\" powershell -NoExit -Command \
             \"chcp 65001 > $null; ssh -t kimbogon@192.168.219.157 \
             'cd /home/kimbogon/projects/goblin && tt++ tin/_combos/담신우조합.tin'\""
        );
    }

    #[test]
    fn 그룹_명령줄_조립() {
        let line = build_windows_cmdline(T, GROUP, "담신우 그룹", true).unwrap();
        // 겹따옴표는 제목 2개 + -Command 인자 2개 = 정확히 4개.
        assert_eq!(line.matches('"').count(), 4, "따옴표 개수: {}", line);
        // 원격 명령 안의 홑따옴표는 PowerShell 규칙대로 두 개로 늘어나야 한다.
        assert!(
            line.contains("''cd /home/kimbogon/projects/goblin && tt++ tin/_combos/담신우조합.tin''"),
            "홑따옴표 이스케이프 실패: {}",
            line
        );
        assert!(line.contains("tmux new-window -t goblin -n 담신우"));
        assert!(line.ends_with("&& tmux attach -t goblin'\""));
        assert!(line.contains("chcp 65001"));
        assert!(line.contains("powershell -NoExit"));
    }

    #[test]
    fn 홑따옴표_이스케이프() {
        assert_eq!(ps_quote("a'b"), "a''b");
        assert_eq!(ps_quote("'x'"), "''x''");
        assert_eq!(ps_quote("따옴표 없음"), "따옴표 없음");
    }

    /// PowerShell 이 실제로 어떻게 되돌려 읽는지 흉내내어, 원본 명령이 복원되는지 본다.
    #[test]
    fn 이스케이프_왕복() {
        for orig in [SOLO, GROUP, "a 'b' c", "''"] {
            let 복원 = ps_quote(orig).replace("''", "'");
            assert_eq!(복원, orig, "왕복 실패: {}", orig);
        }
    }

    #[test]
    fn 그룹은_기존창을_건드리지_않는다() {
        let line = build_windows_cmdline(T, GROUP, "x", true).unwrap();
        assert!(line.contains("tmux new-window"));
        for 금지 in ["kill-window", "kill-session", "kill-server", "respawn", "send-keys"] {
            assert!(!line.contains(금지), "위험한 명령 발견: {}", 금지);
        }
    }

    #[test]
    fn 겹따옴표_주입_차단() {
        let evil = "cd /tmp\" && rm -rf / && echo \"";
        assert!(build_windows_cmdline(T, evil, "x", true).is_err());
    }

    #[test]
    fn 개행_주입_차단() {
        assert!(build_windows_cmdline(T, "echo a\nshutdown /s", "x", true).is_err());
        assert!(build_windows_cmdline(T, "echo a\r\nshutdown /s", "x", true).is_err());
    }

    #[test]
    fn 제목이_명령줄을_못깨뜨린다() {
        let line = build_windows_cmdline(T, SOLO, "나쁜\" & calc & \"제목", true).unwrap();
        assert!(!line.contains("calc\""));
        assert_eq!(line.matches('"').count(), 4);
    }

    #[test]
    fn 빈제목은_기본값() {
        let line = build_windows_cmdline(T, SOLO, "   ", true).unwrap();
        assert!(line.starts_with("/c start \"tinadmin\""));
    }

    #[test]
    fn 잘못된_접속대상_거부() {
        for bad in [
            "kimbogon",
            "@192.168.219.157",
            "kimbogon@",
            "kimbogon@host;rm -rf /",
            "kim bogon@host",
            "kimbogon@host\"",
        ] {
            assert!(build_windows_cmdline(bad, SOLO, "x", true).is_err(), "막혔어야 함: {}", bad);
        }
    }

    #[test]
    fn 정상_접속대상_통과() {
        for good in ["kimbogon@192.168.219.157", "user_1@my-host.example.com", "a@b"] {
            assert!(build_windows_cmdline(good, SOLO, "x", true).is_ok(), "통과해야 함: {}", good);
        }
    }

    #[test]
    fn 빈명령_거부() {
        assert!(build_windows_cmdline(T, "", "x", true).is_err());
        assert!(build_windows_cmdline(T, "   ", "x", true).is_err());
    }

    #[test]
    fn 유닉스_인자조립() {
        let a = build_unix_argv(T, SOLO).unwrap();
        assert_eq!(a, vec!["ssh", "-t", T, SOLO]);
        assert!(build_unix_argv(T, "evil\"cmd").is_err());
    }
}
