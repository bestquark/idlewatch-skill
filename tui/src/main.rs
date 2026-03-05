use anyhow::{anyhow, Context, Result};
use crossterm::{
    event::{self, Event, KeyCode},
    execute,
    terminal::{disable_raw_mode, enable_raw_mode, EnterAlternateScreen, LeaveAlternateScreen},
};
use ratatui::{
    prelude::*,
    widgets::{Block, Borders, List, ListItem, Paragraph},
};
use serde_json::Value;
use std::{
    fs,
    io::{self, Write},
    path::{Path, PathBuf},
    time::Duration,
};

const DEFAULT_PROJECT_ID: &str = "idlewatch-f2b23";

fn default_config_dir() -> PathBuf {
    if let Ok(dir) = std::env::var("IDLEWATCH_ENROLL_CONFIG_DIR") {
        return PathBuf::from(dir);
    }
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".idlewatch")
}

fn sanitize_host(host: &str) -> String {
    host.chars()
        .map(|c| if c.is_ascii_alphanumeric() || matches!(c, '_' | '.' | '-') { c } else { '_' })
        .collect()
}

fn write_secure_file(path: &Path, content: &str) -> Result<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(path, content)?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(path, fs::Permissions::from_mode(0o600))?;
    }
    Ok(())
}

fn parse_service_account(path: &Path) -> Result<Value> {
    let raw = fs::read_to_string(path).context("failed to read service-account JSON")?;
    let json: Value = serde_json::from_str(&raw).context("invalid JSON in service-account file")?;
    if json.get("type").and_then(|v| v.as_str()) != Some("service_account") {
        return Err(anyhow!("credential file is not a service_account JSON key"));
    }
    Ok(json)
}

fn render_menu(terminal: &mut Terminal<CrosstermBackend<io::Stdout>>, selected: usize, cfg: &Path) -> Result<()> {
    terminal.draw(|f| {
        let chunks = Layout::default()
            .direction(Direction::Vertical)
            .margin(1)
            .constraints([Constraint::Length(10), Constraint::Length(8), Constraint::Length(3), Constraint::Min(1)])
            .split(f.area());

        let title_block = Block::default()
            .borders(Borders::ALL)
            .title("🐭 IdleWatch // Technopunk Setup")
            .border_style(Style::default().fg(Color::Magenta));

        let ascii = Paragraph::new(r#"      .-''''-.        ____   __  ____
    .'  .-.  '.     /\   \\ /  \/  __\\
   /   /   \\   \\   /  \\   Y  /  /\  /\
   |   | 00 |   |  / /\\ \\     /  / /\ \\
   \\   \\_^_/   /  / ____ \\ |\\  \\ \\ \\_\\
    '._     _.'  /_/    \\_\\| \\__\\ \\____/
       '---'          C H R O N O  M O D E"#)
        .style(Style::default().fg(Color::Cyan))
        .block(title_block);
        f.render_widget(ascii, chunks[0]);

        let items = [
            "Managed cloud (recommended)",
            "Local-only (no cloud writes)",
        ]
        .iter()
        .enumerate()
        .map(|(i, item)| {
            if i == selected {
                ListItem::new(format!("❯ {}", item)).style(
                    Style::default()
                        .fg(Color::Black)
                        .bg(Color::LightGreen)
                        .add_modifier(Modifier::BOLD),
                )
            } else {
                ListItem::new(format!("  {}", item)).style(Style::default().fg(Color::Gray))
            }
        })
        .collect::<Vec<_>>();

        let list = List::new(items).block(
            Block::default()
                .borders(Borders::ALL)
                .title("Mode")
                .border_style(Style::default().fg(Color::Blue)),
        );
        f.render_widget(list, chunks[1]);

        let path = Paragraph::new(format!("Config dir: {}", cfg.display()))
            .style(Style::default().fg(Color::Yellow))
            .block(
                Block::default()
                    .borders(Borders::ALL)
                    .title("Storage")
                    .border_style(Style::default().fg(Color::Green)),
            );
        f.render_widget(path, chunks[2]);

        let help = Paragraph::new("↑/↓ move • Enter select • q quit")
            .style(Style::default().fg(Color::Magenta).add_modifier(Modifier::BOLD));
        f.render_widget(help, chunks[3]);
    })?;
    Ok(())
}

fn read_line(prompt: &str) -> Result<String> {
    print!("{}", prompt);
    io::stdout().flush()?;
    let mut s = String::new();
    io::stdin().read_line(&mut s)?;
    Ok(s.trim().to_string())
}

fn main() -> Result<()> {
    let config_dir = default_config_dir();
    let env_file = std::env::var("IDLEWATCH_ENROLL_OUTPUT_ENV_FILE")
        .map(PathBuf::from)
        .unwrap_or_else(|_| config_dir.join("idlewatch.env"));
    let host = sanitize_host(&std::env::var("HOSTNAME").unwrap_or_else(|_| "host".to_string()));

    enable_raw_mode()?;
    let mut stdout = io::stdout();
    execute!(stdout, EnterAlternateScreen)?;
    let backend = CrosstermBackend::new(stdout);
    let mut terminal = Terminal::new(backend)?;

    let mut selected = 0usize;
    loop {
        render_menu(&mut terminal, selected, &config_dir)?;
        if event::poll(Duration::from_millis(250))? {
            if let Event::Key(key) = event::read()? {
                match key.code {
                    KeyCode::Up => selected = selected.saturating_sub(1),
                    KeyCode::Down => selected = (selected + 1).min(1),
                    KeyCode::Enter => break,
                    KeyCode::Char('q') | KeyCode::Esc => {
                        disable_raw_mode()?;
                        execute!(terminal.backend_mut(), LeaveAlternateScreen)?;
                        return Ok(());
                    }
                    _ => {}
                }
            }
        }
    }

    disable_raw_mode()?;
    execute!(terminal.backend_mut(), LeaveAlternateScreen)?;

    let mode = match selected {
        0 => "production",
        _ => "local",
    };

    let mut env_lines = vec![
        "# Generated by idlewatch-agent quickstart (Rust TUI)".to_string(),
        "IDLEWATCH_OPENCLAW_USAGE=auto".to_string(),
        format!("IDLEWATCH_LOCAL_LOG_PATH={}", config_dir.join("logs").join(format!("{}-metrics.ndjson", host)).display()),
        format!(
            "IDLEWATCH_OPENCLAW_LAST_GOOD_CACHE_PATH={}",
            config_dir.join("cache").join(format!("{}-openclaw-last-good.json", host)).display()
        ),
    ];

    if mode == "local" {
        env_lines.push("# Local-only mode (no Firebase writes).".to_string());
    } else {
        env_lines.push(format!("FIREBASE_PROJECT_ID={}", DEFAULT_PROJECT_ID));
    }

    if mode == "production" {
        let path = read_line("Service-account JSON path: ")?;
        let input = PathBuf::from(path);
        if !input.exists() {
            return Err(anyhow!("service-account file not found"));
        }
        let json = parse_service_account(&input)?;
        let project_id = json
            .get("project_id")
            .and_then(|v| v.as_str())
            .unwrap_or(DEFAULT_PROJECT_ID);

        let creds_path = config_dir
            .join("credentials")
            .join(format!("{}-service-account.json", project_id));
        let raw = fs::read_to_string(&input)?;
        write_secure_file(&creds_path, &raw)?;
        env_lines.push(format!("FIREBASE_SERVICE_ACCOUNT_FILE={}", creds_path.display()));
        env_lines.push("IDLEWATCH_REQUIRE_FIREBASE_WRITES=1".to_string());
    }

    write_secure_file(&env_file, &format!("{}\n", env_lines.join("\n")))?;
    println!("Enrollment complete. Mode={} envFile={}", mode, env_file.display());
    println!("Next step: set -a; source \"{}\"; set +a", env_file.display());
    println!("Then run: idlewatch-agent --once");
    Ok(())
}
