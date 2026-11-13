import Cocoa
import Network
import WebKit

// Serve the bundled site on loopback so camera permissions and workers use a secure origin.
final class GameServer {
    private let queue = DispatchQueue(label: "stratix.web")
    private var listener: NWListener?
    private var files: [String: URL] = [:]
    private let preferredPort: NWEndpoint.Port = 48632

    init(root: URL) {
        let base = root.standardizedFileURL.path + "/"
        let keys: [URLResourceKey] = [.isRegularFileKey, .isSymbolicLinkKey]
        let entries = FileManager.default.enumerator(at: root, includingPropertiesForKeys: keys,
                                                    options: [.skipsHiddenFiles])
        while let file = entries?.nextObject() as? URL {
            guard let info = try? file.resourceValues(forKeys: Set(keys)),
                  info.isRegularFile == true, info.isSymbolicLink != true else { continue }
            files["/" + file.standardizedFileURL.path.dropFirst(base.count)] = file
        }
        files["/"] = files["/index.html"]
    }

    func start(onReady: @escaping (URL) -> Void, onError: @escaping (String) -> Void) {
        guard files["/"] != nil else { onError("Oyun dosyaları bulunamadı."); return }
        listen(on: preferredPort, onReady: onReady, onError: onError)
    }

    private func listen(on port: NWEndpoint.Port, onReady: @escaping (URL) -> Void,
                        onError: @escaping (String) -> Void) {
        do {
            let parameters = NWParameters.tcp
            parameters.requiredLocalEndpoint = .hostPort(host: "127.0.0.1", port: port)
            let service = try NWListener(using: parameters)
            listener = service
            service.newConnectionHandler = { [weak self] connection in
                connection.start(queue: self?.queue ?? .main)
                self?.read(connection, header: Data())
            }
            service.stateUpdateHandler = { [weak self, weak service] state in
                switch state {
                case .ready:
                    guard let actual = service?.port,
                          let url = URL(string: "http://127.0.0.1:\(actual.rawValue)/") else { return }
                    DispatchQueue.main.async { onReady(url) }
                case .failed(let error):
                    service?.cancel()
                    if error == .posix(.EADDRINUSE) && port != .any {
                        self?.listen(on: .any, onReady: onReady, onError: onError)
                    } else {
                        DispatchQueue.main.async { onError(error.localizedDescription) }
                    }
                default: break
                }
            }
            service.start(queue: queue)
        } catch { DispatchQueue.main.async { onError(error.localizedDescription) } }
    }

    private func read(_ connection: NWConnection, header: Data) {
        connection.receive(minimumIncompleteLength: 1, maximumLength: 8192) { [weak self] data, _, done, error in
            guard let self = self, error == nil, let data = data else { connection.cancel(); return }
            let request = header + data
            guard request.count <= 16384 else { connection.cancel(); return }
            let end = Data([13, 10, 13, 10])
            guard let boundary = request.range(of: end) else {
                if done { connection.cancel() } else { self.read(connection, header: request) }
                return
            }
            let lines = String(decoding: request[..<boundary.lowerBound], as: UTF8.self).components(separatedBy: "\r\n")
            let parts = lines[0].split(separator: " ")
            let host = "127.0.0.1:" + String(self.listener?.port?.rawValue ?? 0)
            guard parts.count == 3, parts[0] == "GET" || parts[0] == "HEAD",
                  lines.dropFirst().contains(where: { $0.lowercased() == "host: " + host }) else {
                self.respond(connection, status: "400 Bad Request"); return
            }
            let path = String(parts[1].prefix(while: { $0 != "?" })).removingPercentEncoding
            guard let path = path, let file = self.files[path],
                  let body = try? Data(contentsOf: file, options: .mappedIfSafe) else {
                self.respond(connection, status: "404 Not Found"); return
            }
            let mime = ["html":"text/html; charset=utf-8", "js":"text/javascript", "css":"text/css",
                        "svg":"image/svg+xml", "webp":"image/webp", "png":"image/png", "wasm":"application/wasm",
                        "webmanifest":"application/manifest+json", "woff":"font/woff", "woff2":"font/woff2",
                        "txt":"text/plain"][file.pathExtension] ?? "application/octet-stream"
            self.respond(connection, status: "200 OK", mime: mime, data: body, head: parts[0] == "HEAD")
        }
    }

    private func respond(_ connection: NWConnection, status: String, mime: String = "text/plain",
                         data: Data = Data(), head: Bool = false) {
        let header = "HTTP/1.1 \(status)\r\nContent-Type: \(mime)\r\nContent-Length: \(data.count)\r\nCache-Control: no-cache\r\nConnection: close\r\n\r\n"
        var result = Data(header.utf8)
        if !head { result.append(data) }
        connection.send(content: result, completion: .contentProcessed { _ in connection.cancel() })
    }

    func stop() { listener?.cancel() }
}

final class GameApp: NSObject, NSApplicationDelegate, WKUIDelegate {
    private var server: GameServer?
    private var window: NSWindow?
    private var origin: URL?

    func applicationDidFinishLaunching(_ notification: Notification) {
        let menu = NSMenu()
        let item = menu.addItem(withTitle: "STRATIX", action: nil, keyEquivalent: "")
        let actions = NSMenu()
        actions.addItem(withTitle: "Quit STRATIX", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        item.submenu = actions
        NSApp.mainMenu = menu

        let config = WKWebViewConfiguration()
        config.preferences.isElementFullscreenEnabled = true
        let web = WKWebView(frame: .zero, configuration: config)
        web.uiDelegate = self
        let window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 1120, height: 720),
                              styleMask: [.titled, .closable, .miniaturizable, .resizable],
                              backing: .buffered, defer: false)
        window.title = "STRATIX"
        window.minSize = NSSize(width: 340, height: 320)
        window.contentView = web
        window.center()
        window.setFrameAutosaveName("STRATIX Flight")
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
        self.window = window
        let root = Bundle.main.resourceURL!.appendingPathComponent("game", isDirectory: true)
        let host = GameServer(root: root)
        server = host
        host.start(onReady: { url in
            self.origin = url
            web.load(URLRequest(url: url))
        }, onError: { message in
            let alert = NSAlert()
            alert.messageText = "STRATIX açılamadı"
            alert.informativeText = message
            alert.runModal()
            NSApp.terminate(nil)
        })
    }

    func webView(_ webView: WKWebView, requestMediaCapturePermissionFor origin: WKSecurityOrigin,
                 initiatedByFrame frame: WKFrameInfo, type: WKMediaCaptureType,
                 decisionHandler: @escaping (WKPermissionDecision) -> Void) {
        let localGame = frame.isMainFrame && origin.protocol == "http" &&
                        origin.host == "127.0.0.1" && origin.port == self.origin?.port
        decisionHandler(localGame && type == .camera ? .prompt : .deny)
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }
    func applicationWillTerminate(_ notification: Notification) { server?.stop() }
}

let application = NSApplication.shared
let delegate = GameApp()
application.setActivationPolicy(.regular)
application.delegate = delegate
application.run()
