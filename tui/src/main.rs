use anyhow::{anyhow, Result};
use crossterm::{
    event::{self, Event, KeyCode, KeyEvent, KeyModifiers},
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
    group: &'static str,
    label: &'static str,
    description: &'static str,
    available: bool,
    selected: bool,
}

#[derive(Default)]
struct ExistingConfig {
    device_name: Option<String>,
    device_id: Option<String>,
    cloud_api_key: Option<String>,
    monitor_targets: Vec<String>,
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

fn machine_name() -> String {
    if cfg!(target_os = "macos") {
        if let Ok(output) = Command::new("scutil").args(["--get", "ComputerName"]).output() {
            if output.status.success() {
                let name = String::from_utf8_lossy(&output.stdout).trim().to_string();
                if !name.is_empty() {
                    return name;
                }
            }
        }
    }

    if let Ok(output) = Command::new("hostname").output() {
        if output.status.success() {
            let name = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if !name.is_empty() {
                return name;
            }
        }
    }

    std::env::var("HOSTNAME")
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| "IdleWatch Device".to_string())
}

fn parse_env_file(path: &Path) -> ExistingConfig {
    let mut config = ExistingConfig::default();
    let Ok(raw) = fs::read_to_string(path) else {
        return config;
    };

    for line in raw.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }
        let Some((key, value)) = trimmed.split_once('=') else {
            continue;
        };
        let value = value.trim().trim_matches('"').trim_matches('\'').to_string();
        match key.trim() {
            "IDLEWATCH_DEVICE_NAME" => config.device_name = Some(value),
            "IDLEWATCH_DEVICE_ID" => config.device_id = Some(value),
            "IDLEWATCH_CLOUD_API_KEY" => config.cloud_api_key = Some(value),
            "IDLEWATCH_MONITOR_TARGETS" => {
                config.monitor_targets = value
                    .split(',')
                    .map(|item| item.trim().to_string())
                    .filter(|item| !item.is_empty())
                    .collect();
            }
            _ => {}
        }
    }

    config
}

fn detect_monitor_targets(existing: &[String]) -> Vec<MonitorTarget> {
    let openclaw_available = command_exists("openclaw", &["--help"]);
    let gpu_available = cfg!(target_os = "macos") || command_exists("nvidia-smi", &["--help"]);
    let home_dir = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
    let provider_quota_available =
        home_dir.join(".codex/auth.json").exists()
            || home_dir.join(".claude/.credentials.json").exists()
            || home_dir.join(".gemini/oauth_creds.json").exists()
            || command_exists("codex", &["--help"])
            || command_exists("claude", &["--help"])
            || command_exists("gemini", &["--help"]);
    let has_existing = !existing.is_empty();
    let wants = |key: &str, fallback: bool| {
        let has_legacy_openclaw = existing.iter().any(|item| item == "openclaw");
        if has_existing {
            existing.iter().any(|item| item == key) || (has_legacy_openclaw && matches!(key, "agent_activity" | "token_usage" | "runtime_state"))
        } else {
            fallback
        }
    };

    vec![
        MonitorTarget {
            key: "cpu",
            group: "Compute",
            label: "CPU usage",
            description: "machine load",
            available: true,
            selected: wants("cpu", true),
        },
        MonitorTarget {
            key: "memory",
            group: "Compute",
            label: "Memory usage",
            description: "resident memory pressure",
            available: true,
            selected: wants("memory", true),
        },
        MonitorTarget {
            key: "gpu",
            group: "Compute",
            label: "GPU usage",
            description: "accelerator load",
            available: gpu_available,
            selected: wants("gpu", gpu_available),
        },
        MonitorTarget {
            key: "temperature",
            group: "Compute",
            label: "Temperature",
            description: "cpu temp when available, thermal state otherwise",
            available: cfg!(target_os = "macos"),
            selected: wants("temperature", cfg!(target_os = "macos")),
        },
        MonitorTarget {
            key: "agent_activity",
            group: "OpenClaw Agents",
            label: "Idle / awake time",
            description: "cron run history and idle wedges",
            available: openclaw_available,
            selected: wants("agent_activity", openclaw_available),
        },
        MonitorTarget {
            key: "token_usage",
            group: "OpenClaw Agents",
            label: "Token usage",
            description: "total, input, output, rate",
            available: openclaw_available,
            selected: wants("token_usage", openclaw_available),
        },
        MonitorTarget {
            key: "runtime_state",
            group: "OpenClaw Agents",
            label: "Runtime metadata",
            description: "provider, model, session state",
            available: openclaw_available,
            selected: wants("runtime_state", openclaw_available),
        },
        MonitorTarget {
            key: "provider_quota",
            group: "Provider Quota",
            label: "Quota + reset",
            description: "codex, claude, gemini windows when configured",
            available: provider_quota_available,
            selected: wants("provider_quota", false),
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

        let help = Paragraph::new("↑/↓ move • Enter select • Ctrl+C quit")
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
                Constraint::Length(16),
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

        let mut items = Vec::new();
        let mut last_group = "";
        for (idx, target) in monitors.iter().enumerate() {
            if target.group != last_group {
                last_group = target.group;
                items.push(
                    ListItem::new(format!("  {}", target.group))
                        .style(Style::default().fg(Color::LightMagenta).add_modifier(Modifier::BOLD)),
                );
            }

                let marker = if target.selected { "[x]" } else { "[ ]" };
                let unavailable = if target.available { "" } else { " (not detected)" };
                let line = format!("{} {} — {}{}", marker, target.label, target.description, unavailable);

                let item = if idx == cursor {
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
                };
                items.push(item);
        }

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

fn render_device_name_prompt(
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

        let header = Paragraph::new("Give this machine a name that will appear on idlewatch.com")
            .style(Style::default().fg(Color::LightMagenta).add_modifier(Modifier::BOLD))
            .block(
                Block::default()
                    .borders(Borders::ALL)
                    .title("Device Name")
                    .border_style(Style::default().fg(Color::Magenta)),
            );
        f.render_widget(header, chunks[0]);

        let content = if input.trim().is_empty() { "Mac mini, Work Laptop, Studio PC…" } else { input };
        let input_style = if input.trim().is_empty() {
            Style::default().fg(Color::DarkGray)
        } else {
            Style::default().fg(Color::White)
        };

        let input_box = Paragraph::new(content).style(input_style).block(
            Block::default()
                .borders(Borders::ALL)
                .title("Device")
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

        let help = Paragraph::new("Type name • Backspace edit • Enter continue • Ctrl+C quit")
            .style(Style::default().fg(Color::LightMagenta).add_modifier(Modifier::BOLD));
        f.render_widget(help, chunks[3]);
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

        let help = Paragraph::new("Paste key • Backspace edit • Enter continue • Ctrl+C quit")
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

fn normalize_device_name(raw: &str, fallback: &str) -> String {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        fallback.to_string()
    } else {
        trimmed.split_whitespace().collect::<Vec<_>>().join(" ")
    }
}

fn sanitize_device_id(raw: &str, fallback: &str) -> String {
    let normalized = normalize_device_name(raw, fallback).to_lowercase();
    let mut out = normalized
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() || matches!(c, '.' | '_' | '-') { c } else { '-' })
        .collect::<String>();
    while out.contains("--") {
        out = out.replace("--", "-");
    }
    out.trim_matches('-').to_string()
}

fn is_quit_key(key: &KeyEvent) -> bool {
    matches!(key.code, KeyCode::Esc | KeyCode::Char('q'))
        || (matches!(key.code, KeyCode::Char('c')) && key.modifiers.contains(KeyModifiers::CONTROL))
}

fn main() -> Result<()> {
    let config_dir = default_config_dir();
    let env_file = std::env::var("IDLEWATCH_ENROLL_OUTPUT_ENV_FILE")
        .map(PathBuf::from)
        .unwrap_or_else(|_| config_dir.join("idlewatch.env"));
    let host = sanitize_host(&machine_name());
    let existing = parse_env_file(&env_file);

    enable_raw_mode()?;
    let mut stdout = io::stdout();
    execute!(stdout, EnterAlternateScreen)?;
    let backend = CrosstermBackend::new(stdout);
    let mut terminal = Terminal::new(backend)?;

    let mut selected_mode = if existing.cloud_api_key.is_some() { 0usize } else { 1usize };
    loop {
        render_mode_menu(&mut terminal, selected_mode, &config_dir)?;
        if event::poll(Duration::from_millis(250))? {
            if let Event::Key(key) = event::read()? {
                match key.code {
                    KeyCode::Up => selected_mode = selected_mode.saturating_sub(1),
                    KeyCode::Down => selected_mode = (selected_mode + 1).min(1),
                    KeyCode::Enter => break,
                    _ if is_quit_key(&key) => {
                        disable_raw_mode()?;
                        execute!(terminal.backend_mut(), LeaveAlternateScreen)?;
                        return Err(anyhow!("setup_cancelled"));
                    }
                    _ => {}
                }
            }
        }
    }

    let mut monitor_targets = detect_monitor_targets(&existing.monitor_targets);
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
                    _ if is_quit_key(&key) => {
                        disable_raw_mode()?;
                        execute!(terminal.backend_mut(), LeaveAlternateScreen)?;
                        return Err(anyhow!("setup_cancelled"));
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

    let mut device_name_input = existing
        .device_name
        .clone()
        .unwrap_or_else(|| host.clone());
    let mut device_name_error: Option<String> = None;
    loop {
        render_device_name_prompt(
            &mut terminal,
            &device_name_input,
            device_name_error.as_deref(),
        )?;
        if event::poll(Duration::from_millis(250))? {
            match event::read()? {
                Event::Key(key) => match key.code {
                    KeyCode::Enter => {
                        let normalized = normalize_device_name(&device_name_input, &host);
                        if !normalized.trim().is_empty() {
                            device_name_input = normalized;
                            break;
                        }
                        device_name_error = Some("Device name cannot be empty.".to_string());
                    }
                    KeyCode::Backspace => {
                        device_name_input.pop();
                        device_name_error = None;
                    }
                    _ if is_quit_key(&key) => {
                        disable_raw_mode()?;
                        execute!(terminal.backend_mut(), LeaveAlternateScreen)?;
                        return Err(anyhow!("setup_cancelled"));
                    }
                    KeyCode::Char(c) => {
                        device_name_input.push(c);
                        device_name_error = None;
                    }
                    _ => {}
                },
                Event::Paste(text) => {
                    device_name_input.push_str(&text);
                    device_name_error = None;
                }
                _ => {}
            }
        }
    }

    let mut cloud_api_key_input = existing.cloud_api_key.clone().unwrap_or_default();
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
                        _ if is_quit_key(&key) => {
                            disable_raw_mode()?;
                            execute!(terminal.backend_mut(), LeaveAlternateScreen)?;
                            return Err(anyhow!("setup_cancelled"));
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

    let monitor_openclaw_usage = monitor_targets_csv
        .split(',')
        .any(|item| matches!(item, "token_usage" | "runtime_state"));
    let device_name = normalize_device_name(&device_name_input, &host);
    let safe_device_id = {
        let candidate = sanitize_device_id(
            existing.device_id.as_deref().unwrap_or(&device_name),
            &host,
        );
        if candidate.is_empty() { host.clone() } else { candidate }
    };

    let mut env_lines = vec![
        "# Generated by idlewatch-agent".to_string(),
        format!("IDLEWATCH_DEVICE_NAME={}", device_name),
        format!("IDLEWATCH_DEVICE_ID={}", safe_device_id),
        format!("IDLEWATCH_MONITOR_TARGETS={}", monitor_targets_csv),
        format!("IDLEWATCH_OPENCLAW_USAGE={}", if monitor_openclaw_usage { "auto" } else { "off" }),
        format!(
            "IDLEWATCH_LOCAL_LOG_PATH={}",
            config_dir.join("logs").join(format!("{}-metrics.ndjson", safe_device_id)).display()
        ),
        format!(
            "IDLEWATCH_OPENCLAW_LAST_GOOD_CACHE_PATH={}",
            config_dir
                .join("cache")
                .join(format!("{}-openclaw-last-good.json", safe_device_id))
                .display()
        ),
    ];

    if mode == "local" {
        env_lines.push("# Local-only mode (no cloud writes).".to_string());
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
    let mode_label = if mode == "production" { "cloud" } else { "local-only" };
    println!("Settings saved.");
    println!("Mode: {}", mode_label);
    println!("Config: {}", env_file.display());
    println!("Device: {}", device_name);
    println!("Next step: idlewatch --once");
    println!("Change later: idlewatch configure");
    if cfg!(target_os = "macos") {
        println!("Background mode: idlewatch install-agent");
    }
    Ok(())
}
