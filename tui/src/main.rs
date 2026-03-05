use anyhow::{anyhow, Result};
use crossterm::{
    event::{self, Event, KeyCode},
    execute,
    terminal::{disable_raw_mode, enable_raw_mode, EnterAlternateScreen, LeaveAlternateScreen},
};
use ratatui::{
    prelude::*,
    widgets::{Block, Borders, List, ListItem, Paragraph},
};
use std::{
    fs,
    io::{self, Write},
    path::{Path, PathBuf},
    time::Duration,
};

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


fn render_menu(terminal: &mut Terminal<CrosstermBackend<io::Stdout>>, selected: usize, cfg: &Path) -> Result<()> {
    terminal.draw(|f| {
        let chunks = Layout::default()
            .direction(Direction::Vertical)
            .margin(1)
            .constraints([Constraint::Length(4), Constraint::Length(8), Constraint::Length(3), Constraint::Min(1)])
            .split(f.area());

        let title_block = Block::default()
            .borders(Borders::ALL)
            .title("IdleWatch")
            .border_style(Style::default().fg(Color::Magenta));

        let header = Paragraph::new("IdleWatch Setup")
            .style(Style::default().fg(Color::LightMagenta).add_modifier(Modifier::BOLD))
            .block(title_block);
        f.render_widget(header, chunks[0]);

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
                        .bg(Color::LightMagenta)
                        .add_modifier(Modifier::BOLD),
                )
            } else {
                ListItem::new(format!("  {}", item)).style(Style::default().fg(Color::Cyan))
            }
        })
        .collect::<Vec<_>>();

        let list = List::new(items).block(
            Block::default()
                .borders(Borders::ALL)
                .title("Mode")
                .border_style(Style::default().fg(Color::Cyan)),
        );
        f.render_widget(list, chunks[1]);

        let path = Paragraph::new(format!("Config dir: {}", cfg.display()))
            .style(Style::default().fg(Color::White))
            .block(
                Block::default()
                    .borders(Borders::ALL)
                    .title("Storage")
                    .border_style(Style::default().fg(Color::Cyan)),
            );
        f.render_widget(path, chunks[2]);

        let help = Paragraph::new("↑/↓ move • Enter select • q quit")
            .style(Style::default().fg(Color::LightMagenta).add_modifier(Modifier::BOLD));
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
        env_lines.push("# Local-only mode (no cloud/Firebase writes).".to_string());
    }

    if mode == "production" {
        let api_key = read_line("Cloud API key (from idlewatch.com/dashboard): ")?;
        if api_key.trim().is_empty() {
            return Err(anyhow!("cloud API key is required"));
        }
        env_lines.push("IDLEWATCH_CLOUD_INGEST_URL=https://idlewatch.com/api/ingest".to_string());
        env_lines.push(format!("IDLEWATCH_CLOUD_API_KEY={}", api_key.trim()));
        env_lines.push("IDLEWATCH_REQUIRE_CLOUD_WRITES=1".to_string());
    }

    write_secure_file(&env_file, &format!("{}\n", env_lines.join("\n")))?;
    println!("Enrollment complete. Mode={} envFile={}", mode, env_file.display());
    println!("Next step: set -a; source \"{}\"; set +a", env_file.display());
    println!("Then run: idlewatch-agent --once");
    Ok(())
}
