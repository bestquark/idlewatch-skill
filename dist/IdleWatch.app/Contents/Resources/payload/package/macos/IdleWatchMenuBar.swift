import AppKit
import Foundation

struct ProviderQuotaCache: Decodable {
  let updatedAtMs: Double?
  let providerQuotas: [ProviderQuota]
  let providerConnections: [ProviderConnection]?
}

struct ProviderQuota: Decodable {
  let providerId: String?
  let providerName: String?
  let accountEmail: String?
  let accountPlan: String?
  let updatedAtMs: Double?
  let windows: [QuotaWindow]
}

struct ProviderConnection: Decodable {
  let providerId: String?
  let providerName: String?
  let status: String?
  let detail: String?
  let loginCommand: String?
  let accountEmail: String?
  let accountPlan: String?
  let updatedAtMs: Double?
}

struct QuotaWindow: Decodable {
  let key: String?
  let label: String?
  let usedPercent: Double?
  let remainingPercent: Double?
  let resetsAtMs: Double?
}

struct QuotaSnapshot {
  let cacheURL: URL
  let updatedAt: Date?
  let providers: [ProviderQuota]
  let connections: [ProviderConnection]
}

final class AppDelegate: NSObject, NSApplicationDelegate {
  private let statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
  private let menu = NSMenu()
  private let webDashboardURL = URL(string: "https://idlewatch.com/dashboard")!
  private let webAPIURL = URL(string: "https://idlewatch.com/api")!
  private let localDashboardURL = URL(string: "http://127.0.0.1:4373")!
  private let cacheDirectory = URL(fileURLWithPath: NSHomeDirectory(), isDirectory: true)
    .appendingPathComponent(".idlewatch", isDirectory: true)
    .appendingPathComponent("cache", isDirectory: true)
  private let configDirectory = URL(fileURLWithPath: NSHomeDirectory(), isDirectory: true)
    .appendingPathComponent(".idlewatch", isDirectory: true)

  private var refreshTimer: Timer?
  private let dateFormatter: DateFormatter = {
    let formatter = DateFormatter()
    formatter.dateStyle = .medium
    formatter.timeStyle = .short
    return formatter
  }()
  private let relativeFormatter: RelativeDateTimeFormatter = {
    let formatter = RelativeDateTimeFormatter()
    formatter.unitsStyle = .short
    return formatter
  }()

  func applicationDidFinishLaunching(_ notification: Notification) {
    if let button = statusItem.button {
      button.image = NSImage(systemSymbolName: "chart.bar.xaxis", accessibilityDescription: "IdleWatch")
      button.imagePosition = .imageLeading
      button.title = "IW"
      button.toolTip = "IdleWatch"
    }

    statusItem.menu = menu
    rebuildMenu(snapshot: nil)
    refreshSnapshot()

    refreshTimer = Timer.scheduledTimer(withTimeInterval: 45, repeats: true) { [weak self] _ in
      self?.refreshSnapshot()
    }
  }

  func applicationWillTerminate(_ notification: Notification) {
    refreshTimer?.invalidate()
  }

  @objc private func refreshNow(_ sender: Any?) {
    refreshSnapshot()
  }

  @objc private func openWebDashboard(_ sender: Any?) {
    NSWorkspace.shared.open(webDashboardURL)
  }

  @objc private func openAPIKeys(_ sender: Any?) {
    NSWorkspace.shared.open(webAPIURL)
  }

  @objc private func openConfigFolder(_ sender: Any?) {
    NSWorkspace.shared.open(configDirectory)
  }

  @objc private func openLocalDashboard(_ sender: Any?) {
    launchBundleCommand(arguments: ["dashboard"])
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.7) { [localDashboardURL] in
      NSWorkspace.shared.open(localDashboardURL)
    }
  }

  @objc private func runQuickstart(_ sender: Any?) {
    runInTerminal(arguments: ["quickstart"])
  }

  @objc private func showStatus(_ sender: Any?) {
    runInTerminal(arguments: ["status"])
  }

  @objc private func connectCodex(_ sender: Any?) {
    runShellCommandInTerminal("codex login")
  }

  @objc private func connectClaude(_ sender: Any?) {
    runShellCommandInTerminal("claude auth login")
  }

  @objc private func connectGemini(_ sender: Any?) {
    runShellCommandInTerminal("gemini")
  }

  @objc private func quit(_ sender: Any?) {
    NSApplication.shared.terminate(nil)
  }

  private func refreshSnapshot() {
    let snapshot = loadLatestSnapshot()
    updateStatusItem(snapshot: snapshot)
    rebuildMenu(snapshot: snapshot)
  }

  private func loadLatestSnapshot() -> QuotaSnapshot? {
    let resourceKeys: Set<URLResourceKey> = [.contentModificationDateKey, .isRegularFileKey]

    guard
      let fileURLs = try? FileManager.default.contentsOfDirectory(
        at: cacheDirectory,
        includingPropertiesForKeys: Array(resourceKeys),
        options: [.skipsHiddenFiles]
      )
    else {
      return nil
    }

    let latest = fileURLs
      .filter { $0.lastPathComponent.hasSuffix("-provider-quota.json") }
      .compactMap { fileURL -> (URL, Date)? in
        guard
          let values = try? fileURL.resourceValues(forKeys: resourceKeys),
          values.isRegularFile == true
        else {
          return nil
        }

        return (fileURL, values.contentModificationDate ?? .distantPast)
      }
      .max { lhs, rhs in lhs.1 < rhs.1 }

    guard let latestURL = latest?.0 else {
      return nil
    }

    guard
      let data = try? Data(contentsOf: latestURL),
      let payload = try? JSONDecoder().decode(ProviderQuotaCache.self, from: data)
    else {
      return nil
    }

    let connections = payload.providerConnections ?? []
    guard !payload.providerQuotas.isEmpty || !connections.isEmpty else { return nil }

    let updatedAt = payload.updatedAtMs.map(dateFromTimestamp)
    return QuotaSnapshot(cacheURL: latestURL, updatedAt: updatedAt, providers: payload.providerQuotas, connections: connections)
  }

  private func updateStatusItem(snapshot: QuotaSnapshot?) {
    guard let button = statusItem.button else { return }

    guard
      let snapshot,
      let focusWindow = snapshot.providers
        .flatMap(\.windows)
        .compactMap({ window -> (QuotaWindow, Double)? in
          guard let remaining = window.remainingPercent else { return nil }
          return (window, remaining)
        })
        .min(by: { lhs, rhs in lhs.1 < rhs.1 })
    else {
      button.title = "IW"
      if let snapshot {
        button.toolTip = tooltipText(snapshot: snapshot)
      } else {
        button.toolTip = "IdleWatch\nNo cached provider snapshot yet."
      }
      return
    }

    let remainingLabel = "\(Int(focusWindow.1.rounded()))%"
    button.title = "IW \(remainingLabel)"
    button.toolTip = tooltipText(snapshot: snapshot)
  }

  private func tooltipText(snapshot: QuotaSnapshot) -> String {
    var lines: [String] = ["IdleWatch"]

    if let updatedAt = snapshot.updatedAt {
      lines.append("Updated \(relativeString(for: updatedAt))")
    }

    if !snapshot.connections.isEmpty {
      lines.append("Provider sync")
      for connection in snapshot.connections {
        lines.append("  \(connectionLine(connection))")
      }
    }

    for provider in snapshot.providers {
      let providerLine = [provider.providerName ?? provider.providerId ?? "Provider", provider.accountPlan, provider.accountEmail]
        .compactMap { trimmed($0) }
        .joined(separator: " • ")
      if !providerLine.isEmpty {
        lines.append(providerLine)
      }

      for window in provider.windows.prefix(2) {
        lines.append("  \(windowLine(window))")
      }
    }

    return lines.joined(separator: "\n")
  }

  private func rebuildMenu(snapshot: QuotaSnapshot?) {
    menu.removeAllItems()

    let heading = NSMenuItem(title: "IdleWatch", action: nil, keyEquivalent: "")
    heading.isEnabled = false
    menu.addItem(heading)

    let subtitle = NSMenuItem(title: subtitleLine(snapshot: snapshot), action: nil, keyEquivalent: "")
    subtitle.isEnabled = false
    menu.addItem(subtitle)

    menu.addItem(.separator())

    if let snapshot {
      if !snapshot.connections.isEmpty {
        let syncHeading = NSMenuItem(title: "Provider sync", action: nil, keyEquivalent: "")
        syncHeading.isEnabled = false
        menu.addItem(syncHeading)

        for connection in snapshot.connections {
          let summaryItem = NSMenuItem(title: connectionLine(connection), action: nil, keyEquivalent: "")
          summaryItem.isEnabled = false
          menu.addItem(summaryItem)

          if let detail = trimmed(connection.detail), detail != trimmed(connectionLine(connection)) {
            let detailItem = NSMenuItem(title: "  \(detail)", action: nil, keyEquivalent: "")
            detailItem.isEnabled = false
            menu.addItem(detailItem)
          }

          if let actionItem = providerSyncActionItem(connection) {
            menu.addItem(actionItem)
          }
        }

        menu.addItem(.separator())
      }

      for provider in snapshot.providers {
        let providerTitle = [provider.providerName ?? provider.providerId ?? "Provider", provider.accountPlan]
          .compactMap { trimmed($0) }
          .joined(separator: " • ")
        let providerItem = NSMenuItem(title: providerTitle.isEmpty ? "Provider" : providerTitle, action: nil, keyEquivalent: "")
        providerItem.isEnabled = false
        menu.addItem(providerItem)

        if let email = trimmed(provider.accountEmail) {
          let emailItem = NSMenuItem(title: email, action: nil, keyEquivalent: "")
          emailItem.isEnabled = false
          menu.addItem(emailItem)
        }

        for window in provider.windows {
          let windowItem = NSMenuItem(title: "  \(windowLine(window))", action: nil, keyEquivalent: "")
          windowItem.isEnabled = false
          menu.addItem(windowItem)
        }

        menu.addItem(.separator())
      }
    } else {
      let emptyItem = NSMenuItem(title: "No provider quota cached yet.", action: nil, keyEquivalent: "")
      emptyItem.isEnabled = false
      menu.addItem(emptyItem)

      let hintItem = NSMenuItem(title: "Enable “Quota + reset” in IdleWatch setup.", action: nil, keyEquivalent: "")
      hintItem.isEnabled = false
      menu.addItem(hintItem)
      menu.addItem(.separator())
    }

    menu.addItem(makeActionItem(title: "Refresh now", action: #selector(refreshNow(_:))))
    menu.addItem(makeActionItem(title: "Open web dashboard", action: #selector(openWebDashboard(_:))))
    menu.addItem(makeActionItem(title: "Open API keys", action: #selector(openAPIKeys(_:))))
    menu.addItem(makeActionItem(title: "Open local dashboard", action: #selector(openLocalDashboard(_:))))
    menu.addItem(makeActionItem(title: "Run quickstart in Terminal", action: #selector(runQuickstart(_:))))
    menu.addItem(makeActionItem(title: "Show status in Terminal", action: #selector(showStatus(_:))))
    menu.addItem(makeActionItem(title: "Open IdleWatch folder", action: #selector(openConfigFolder(_:))))
    menu.addItem(.separator())
    menu.addItem(makeActionItem(title: "Quit IdleWatch", action: #selector(quit(_:))))
  }

  private func subtitleLine(snapshot: QuotaSnapshot?) -> String {
    guard let snapshot else {
      return "Waiting for your first provider snapshot"
    }

    let ageLabel = snapshot.updatedAt.map(relativeString(for:)) ?? "time unknown"
    return "Cached \(ageLabel) • \(snapshot.cacheURL.lastPathComponent)"
  }

  private func windowLine(_ window: QuotaWindow) -> String {
    let label = trimmed(window.label) ?? trimmed(window.key) ?? "Window"
    let remaining = window.remainingPercent.map { "\(Int($0.rounded()))% left" } ?? "usage signal"
    let reset = window.resetsAtMs.map(dateFromTimestamp).map(dateFormatter.string(from:)) ?? "reset unknown"
    return "\(label) • \(remaining) • resets \(reset)"
  }

  private func connectionLine(_ connection: ProviderConnection) -> String {
    let providerName = trimmed(connection.providerName) ?? trimmed(connection.providerId) ?? "Provider"
    let status = formatConnectionStatus(connection.status)
    let account = [trimmed(connection.accountPlan), trimmed(connection.accountEmail)]
      .compactMap { $0 }
      .joined(separator: " • ")
    return [providerName, status, account].filter { !$0.isEmpty }.joined(separator: " • ")
  }

  private func formatConnectionStatus(_ status: String?) -> String {
    switch trimmed(status)?.lowercased() {
    case "connected":
      return "connected"
    case "needs_login":
      return "needs login"
    case "not_installed":
      return "not installed"
    case "unsupported":
      return "unsupported"
    case "error":
      return "sync error"
    default:
      return "needs login"
    }
  }

  private func providerSyncActionItem(_ connection: ProviderConnection) -> NSMenuItem? {
    let providerId = trimmed(connection.providerId)?.lowercased()
    let status = trimmed(connection.status)?.lowercased()
    guard status == "needs_login" || status == "error" else { return nil }

    switch providerId {
    case "codex":
      return makeActionItem(title: "Connect Codex in Terminal", action: #selector(connectCodex(_:)))
    case "claude":
      return makeActionItem(title: "Connect Claude in Terminal", action: #selector(connectClaude(_:)))
    case "gemini":
      return makeActionItem(title: "Open Gemini in Terminal", action: #selector(connectGemini(_:)))
    default:
      return nil
    }
  }

  private func makeActionItem(title: String, action: Selector) -> NSMenuItem {
    let item = NSMenuItem(title: title, action: action, keyEquivalent: "")
    item.target = self
    return item
  }

  private func relativeString(for date: Date) -> String {
    relativeFormatter.localizedString(for: date, relativeTo: Date())
  }

  private func runInTerminal(arguments: [String]) {
    let command = shellQuote(wrapperPath())
      + (arguments.isEmpty ? "" : " " + arguments.map(shellQuote).joined(separator: " "))
    runShellCommandInTerminal(command)
  }

  private func runShellCommandInTerminal(_ command: String) {
    let escapedCommand = command
      .replacingOccurrences(of: "\\", with: "\\\\")
      .replacingOccurrences(of: "\"", with: "\\\"")

    let process = Process()
    process.executableURL = URL(fileURLWithPath: "/usr/bin/osascript")
    process.arguments = [
      "-e", "tell application \"Terminal\" to activate",
      "-e", "tell application \"Terminal\" to do script \"\(escapedCommand)\""
    ]

    try? process.run()
  }

  private func launchBundleCommand(arguments: [String]) {
    let process = Process()
    process.executableURL = URL(fileURLWithPath: wrapperPath())
    process.arguments = arguments
    process.standardOutput = FileHandle.nullDevice
    process.standardError = FileHandle.nullDevice
    try? process.run()
  }

  private func wrapperPath() -> String {
    Bundle.main.bundleURL
      .appendingPathComponent("Contents", isDirectory: true)
      .appendingPathComponent("MacOS", isDirectory: true)
      .appendingPathComponent("IdleWatch", isDirectory: false)
      .path
  }

  private func shellQuote(_ value: String) -> String {
    "'\(value.replacingOccurrences(of: "'", with: "'\\''"))'"
  }

  private func trimmed(_ value: String?) -> String? {
    guard let value else { return nil }
    let trimmedValue = value.trimmingCharacters(in: .whitespacesAndNewlines)
    return trimmedValue.isEmpty ? nil : trimmedValue
  }

  private func dateFromTimestamp(_ value: Double) -> Date {
    let seconds = value > 1_000_000_000_000 ? value / 1000 : value
    return Date(timeIntervalSince1970: seconds)
  }
}

@main
struct IdleWatchMenuBarLauncher {
  static func main() {
    let app = NSApplication.shared
    let delegate = AppDelegate()
    app.delegate = delegate
    app.setActivationPolicy(.accessory)
    app.run()
  }
}
