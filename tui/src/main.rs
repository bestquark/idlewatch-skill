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
    io,
    path::{Path, PathBuf},
    process::{Command, Stdio},
    time::Duration,
};

#[derive(Clone)]
struct MonitorTarget {
    key: &'static str,
    label: &'static str,
    available: bool,
    selected: bool,
}

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

fn command_exists(cmd: &str, args: &[&str]) -> bool {
    Command::new(cmd)
        .args(args)
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .map(|status| status.success())
        .unwrap_or(false)
}

fn detect_monitor_targets() -> Vec<MonitorTarget> {
    let openclaw_available = command_exists("openclaw", &["--help"]);
    let gpu_available = cfg!(target_os = "macos") || command_exists("nvidia-smi", &["--help"]);

    vec![
        MonitorTarget {
            key: "cpu",
            label: "CPU usage",
            available: true,
            selected: true,
        },
        MonitorTarget {
            key: "memory",
            label: "Memory usage",
            available: true,
            selected: true,
        },
        MonitorTarget {
            key: "gpu",
            label: "GPU usage",
            available: gpu_available,
            selected: gpu_available,
        },
        MonitorTarget {
            key: "openclaw",
            label: "OpenClaw token telemetry",
            available: openclaw_available,
            selected: openclaw_available,
        },
    ]
}

fn render_mode_menu(terminal: &mut Terminal<CrosstermBackend<io::Stdout>>, selected: usize, cfg: &Path) -> Result<()> {
    terminal.draw(|f| {
        let chunks = Layout::default()
            .direction(Direction::Vertical)
            .margin(1)
            .constraints([
                Constraint::Length(4),
                Constraint::Length(8),
                Constraint::Length(3),
                Constraint::Min(1),
            ])
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
                        .fg(Color::White)
                        .bg(Color::Blue)
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

fn render_monitor_menu(
    terminal: &mut Terminal<CrosstermBackend<io::Stdout>>,
    cursor: usize,
    monitors: &[MonitorTarget],
) -> Result<()> {
    terminal.draw(|f| {
        let chunks = Layout::default()
            .direction(Direction::Vertical)
            .margin(1)
            .constraints([
                Constraint::Length(4),
                Constraint::Length(10),
                Constraint::Min(1),
            ])
            .split(f.area());

        let title = Paragraph::new("Choose what to monitor")
            .style(Style::default().fg(Color::LightMagenta).add_modifier(Modifier::BOLD))
            .block(
                Block::default()
                    .borders(Borders::ALL)
                    .title("Monitor Targets")
                    .border_style(Style::default().fg(Color::Magenta)),
            );
        f.render_widget(title, chunks[0]);

        let items = monitors
            .iter()
            .enumerate()
            .map(|(idx, target)| {
                let marker = if target.selected { "[x]" } else { "[ ]" };
                let unavailable = if target.available { "" } else { " (not detected)" };
                let line = format!("{} {}{}", marker, target.label, unavailable);

                if idx == cursor {
                    ListItem::new(format!("❯ {}", line)).style(
                        Style::default()
                            .fg(Color::White)
                            .bg(Color::Blue)
                            .add_modifier(Modifier::BOLD),
                    )
                } else if target.available {
                    ListItem::new(format!("  {}", line)).style(Style::default().fg(Color::Cyan))
                } else {
                    ListItem::new(format!("  {}", line)).style(Style::default().fg(Color::DarkGray))
                }
            })
            .collect::<Vec<_>>();

        let list = List::new(items).block(
            Block::default()
                .borders(Borders::ALL)
                .title("Targets")
                .border_style(Style::default().fg(Color::Cyan)),
        );
        f.render_widget(list, chunks[1]);

        let help = Paragraph::new("↑/↓ move • Space toggle • Enter continue")
            .style(Style::default().fg(Color::LightMagenta).add_modifier(Modifier::BOLD));
        f.render_widget(help, chunks[2]);
    })?;

    Ok(())
}

fn render_api_key_prompt(
    terminal: &mut Terminal<CrosstermBackend<io::Stdout>>,
    input: &str,
    error_message: Option<&str>,
) -> Result<()> {
    terminal.draw(|f| {
        let chunks = Layout::default()
            .direction(Direction::Vertical)
            .margin(1)
            .constraints([
                Constraint::Length(4),
                Constraint::Length(6),
                Constraint::Length(2),
                Constraint::Min(1),
            ])
            .split(f.area());

        let header = Paragraph::new("Link this device to your IdleWatch account")
            .style(Style::default().fg(Color::LightMagenta).add_modifier(Modifier::BOLD))
            .block(
                Block::default()
                    .borders(Borders::ALL)
                    .title("Cloud API Key")
                    .border_style(Style::default().fg(Color::Magenta)),
            );
        f.render_widget(header, chunks[0]);

        let content = if input.trim().is_empty() {
            "Paste your API key from idlewatch.com/api"
        } else {
            input
        };

        let input_style = if input.trim().is_empty() {
            Style::default().fg(Color::DarkGray)
        } else {
            Style::default().fg(Color::White)
        };

        let input_box = Paragraph::new(content).style(input_style).block(
            Block::default()
                .borders(Borders::ALL)
                .title("API key")
                .border_style(Style::default().fg(Color::Cyan)),
        );
        f.render_widget(input_box, chunks[1]);

        let warning = error_message.unwrap_or(" ");
        let warning_widget = Paragraph::new(warning).style(
            if error_message.is_some() {
                Style::default().fg(Color::Red).add_modifier(Modifier::BOLD)
            } else {
                Style::default().fg(Color::DarkGray)
            },
        );
        f.render_widget(warning_widget, chunks[2]);

        let help = Paragraph::new("Paste key • Backspace edit • Enter continue • q quit")
            .style(Style::default().fg(Color::LightMagenta).add_modifier(Modifier::BOLD));
        f.render_widget(help, chunks[3]);
    })?;

    Ok(())
}

fn normalize_api_key_input(raw: &str) -> String {
    let trimmed = raw.trim();

    for token in trimmed.split_whitespace() {
        if token.starts_with("iwk_") {
            return token.trim_matches(|c: char| c == '"' || c == '\'' || c == ',').to_string();
        }
    }

    trimmed.trim_matches(|c: char| c == '"' || c == '\'').to_string()
}

fn looks_like_api_key(value: &str) -> bool {
    value.starts_with("iwk_") && value.len() >= 20
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

    let mut selected_mode = 0usize;
    loop {
        render_mode_menu(&mut terminal, selected_mode, &config_dir)?;
        if event::poll(Duration::from_millis(250))? {
            if let Event::Key(key) = event::read()? {
                match key.code {
                    KeyCode::Up => selected_mode = selected_mode.saturating_sub(1),
                    KeyCode::Down => selected_mode = (selected_mode + 1).min(1),
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

    let mut monitor_targets = detect_monitor_targets();
    let mut monitor_cursor = 0usize;

    loop {
        render_monitor_menu(&mut terminal, monitor_cursor, &monitor_targets)?;
        if event::poll(Duration::from_millis(250))? {
            if let Event::Key(key) = event::read()? {
                match key.code {
                    KeyCode::Up => monitor_cursor = monitor_cursor.saturating_sub(1),
                    KeyCode::Down => monitor_cursor = (monitor_cursor + 1).min(monitor_targets.len().saturating_sub(1)),
                    KeyCode::Char(' ') => {
                        if let Some(item) = monitor_targets.get_mut(monitor_cursor) {
                            if item.available {
                                item.selected = !item.selected;
                            }
                        }
                    }
                    KeyCode::Enter => {
                        let selected_count = monitor_targets.iter().filter(|item| item.selected && item.available).count();
                        if selected_count == 0 {
                            for item in monitor_targets.iter_mut() {
                                if item.key == "cpu" || item.key == "memory" {
                                    item.selected = true;
                                }
                            }
                        }
                        break;
                    }
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

    let mode = match selected_mode {
        0 => "production",
        _ => "local",
    };

    let mut cloud_api_key_input = String::new();
    let mut cloud_api_key_error: Option<String> = None;
    if mode == "production" {
        loop {
            render_api_key_prompt(
                &mut terminal,
                &cloud_api_key_input,
                cloud_api_key_error.as_deref(),
            )?;
            if event::poll(Duration::from_millis(250))? {
                match event::read()? {
                    Event::Key(key) => match key.code {
                        KeyCode::Enter => {
                            let normalized = normalize_api_key_input(&cloud_api_key_input);
                            if looks_like_api_key(&normalized) {
                                cloud_api_key_input = normalized;
                                break;
                            }
                            cloud_api_key_error = Some(
                                "Invalid key format. Copy the full key from idlewatch.com/api (starts with iwk_)."
                                    .to_string(),
                            );
                        }
                        KeyCode::Backspace => {
                            cloud_api_key_input.pop();
                            cloud_api_key_error = None;
                        }
                        KeyCode::Char('q') | KeyCode::Esc => {
                            disable_raw_mode()?;
                            execute!(terminal.backend_mut(), LeaveAlternateScreen)?;
                            return Ok(());
                        }
                        KeyCode::Char(c) => {
                            cloud_api_key_input.push(c);
                            cloud_api_key_error = None;
                        }
                        _ => {}
                    },
                    Event::Paste(text) => {
                        cloud_api_key_input.push_str(&text);
                        cloud_api_key_error = None;
                    }
                    _ => {}
                }
            }
        }
    }

    disable_raw_mode()?;
    execute!(terminal.backend_mut(), LeaveAlternateScreen)?;

    let selected_keys = monitor_targets
        .iter()
        .filter(|item| item.selected && item.available)
        .map(|item| item.key)
        .collect::<Vec<_>>();

    let monitor_targets_csv = if selected_keys.is_empty() {
        "cpu,memory".to_string()
    } else {
        selected_keys.join(",")
    };

    let monitor_openclaw = monitor_targets_csv.split(',').any(|item| item == "openclaw");

    let mut env_lines = vec![
        "# Generated by idlewatch-agent quickstart (Rust TUI)".to_string(),
        format!("IDLEWATCH_MONITOR_TARGETS={}", monitor_targets_csv),
        format!("IDLEWATCH_OPENCLAW_USAGE={}", if monitor_openclaw { "auto" } else { "off" }),
        format!(
            "IDLEWATCH_LOCAL_LOG_PATH={}",
            config_dir.join("logs").join(format!("{}-metrics.ndjson", host)).display()
        ),
        format!(
            "IDLEWATCH_OPENCLAW_LAST_GOOD_CACHE_PATH={}",
            config_dir
                .join("cache")
                .join(format!("{}-openclaw-last-good.json", host))
                .display()
        ),
    ];

    if mode == "local" {
        env_lines.push("# Local-only mode (no cloud/Firebase writes).".to_string());
    }

    if mode == "production" {
        let api_key = normalize_api_key_input(&cloud_api_key_input);
        if !looks_like_api_key(&api_key) {
            return Err(anyhow!("cloud API key is required"));
        }
        env_lines.push("IDLEWATCH_CLOUD_INGEST_URL=https://api.idlewatch.com/api/ingest".to_string());
        env_lines.push(format!("IDLEWATCH_CLOUD_API_KEY={}", api_key));
        env_lines.push("IDLEWATCH_REQUIRE_CLOUD_WRITES=1".to_string());
    }

    write_secure_file(&env_file, &format!("{}\n", env_lines.join("\n")))?;
    println!("Enrollment complete. Mode={} envFile={}", mode, env_file.display());
    println!("Next step: set -a; source \"{}\"; set +a", env_file.display());
    println!("Then run: idlewatch-agent --once");
    Ok(())
}
