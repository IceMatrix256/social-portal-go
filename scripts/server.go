package main

import (
	"crypto/tls"
	"errors"
	"fmt"
	"io"
	"log"
	"math/rand/v2"
	"net"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"
)

const requestTimeout = 15 * time.Second

var proxyTargets = map[string]string{
	"/api/reddit":         "https://www.reddit.com",
	"/api/mastodon":       "https://mastodon.social",
	"/api/nostr":          "https://api.nostr.band",
	"/api/lemmy":          "https://lemmy.world",
	"/api/custom-feed":    "https://piefed.social",
	"/api/misskey":        "https://misskey.io",
	"/api/misskey-design": "https://misskey.design",
	"/api/bluesky":        "https://public.api.bsky.app",
}

var userAgents = []string{
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
	"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0",
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:126.0) Gecko/20100101 Firefox/126.0",
}

func main() {
	port := getenv("PORT", "8090")
	distDir := resolveDistDir()

	transport := &http.Transport{
		TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
	}
	client := &http.Client{
		Transport: transport,
		Timeout:   requestTimeout,
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		writeCORS(w)
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"status":"ok"}`))
	})
	mux.HandleFunc("/api/proxy", func(w http.ResponseWriter, r *http.Request) {
		writeCORS(w)
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		if r.Method != http.MethodGet {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		raw := r.URL.Query().Get("url")
		if raw == "" {
			http.Error(w, "missing url query parameter", http.StatusBadRequest)
			return
		}
		if _, err := url.ParseRequestURI(raw); err != nil {
			http.Error(w, "invalid url", http.StatusBadRequest)
			return
		}
		proxyRequest(w, r, client, raw)
	})

	for prefix, target := range proxyTargets {
		p := prefix
		t := target
		mux.HandleFunc(p, func(w http.ResponseWriter, r *http.Request) {
			writeCORS(w)
			if r.Method == http.MethodOptions {
				w.WriteHeader(http.StatusNoContent)
				return
			}
			if r.Method != http.MethodGet {
				http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
				return
			}
			if !strings.HasPrefix(r.URL.Path, p) {
				http.NotFound(w, r)
				return
			}
			suffix := strings.TrimPrefix(r.URL.Path, p)
			targetURL := t + suffix
			if rawQuery := r.URL.RawQuery; rawQuery != "" {
				targetURL += "?" + rawQuery
			}
			proxyRequest(w, r, client, targetURL)
		})
	}

	spa := spaHandler(distDir)
	root := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.URL.Path, "/api/") || r.URL.Path == "/healthz" {
			mux.ServeHTTP(w, r)
			return
		}
		writeCORS(w)
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		spa.ServeHTTP(w, r)
	})

	server := &http.Server{
		Addr:         ":" + port,
		Handler:      logRequests(root),
		ReadTimeout:  20 * time.Second,
		WriteTimeout: 20 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	localIP := detectLocalIP()
	log.Printf("\n--- Social Portal Go Server ---\n")
	log.Printf("Listening on port: %s", port)
	log.Printf("Local:   http://localhost:%s", port)
	log.Printf("Network: http://%s:%s", localIP, port)
	log.Printf("Dist:    %s", distDir)
	log.Printf("--------------------------------\n")

	if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		log.Fatal(err)
	}
}

func proxyRequest(w http.ResponseWriter, r *http.Request, client *http.Client, targetURL string) {
	req, err := http.NewRequestWithContext(r.Context(), http.MethodGet, targetURL, nil)
	if err != nil {
		http.Error(w, fmt.Sprintf("bad target request: %v", err), http.StatusBadRequest)
		return
	}
	req.Header.Set("User-Agent", userAgents[rand.IntN(len(userAgents))])
	req.Header.Set("Accept", "application/rss+xml, application/xml, text/xml, application/json, */*")
	req.Header.Set("Accept-Language", "en-US,en;q=0.5")

	resp, err := client.Do(req)
	if err != nil {
		http.Error(w, fmt.Sprintf("proxy request failed: %v", err), http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()

	for k, values := range resp.Header {
		if shouldSkipHeader(k) {
			continue
		}
		for _, v := range values {
			w.Header().Add(k, v)
		}
	}
	w.WriteHeader(resp.StatusCode)
	_, _ = io.Copy(w, resp.Body)
}

func spaHandler(distDir string) http.Handler {
	fileServer := http.FileServer(http.Dir(distDir))
	indexPath := filepath.Join(distDir, "index.html")
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet && r.Method != http.MethodHead {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		cleanPath := filepath.Clean(strings.TrimPrefix(r.URL.Path, "/"))
		target := filepath.Join(distDir, cleanPath)
		if cleanPath == "." {
			fileServer.ServeHTTP(w, r)
			return
		}
		if info, err := os.Stat(target); err == nil && !info.IsDir() {
			fileServer.ServeHTTP(w, r)
			return
		}
		http.ServeFile(w, r, indexPath)
	})
}

func shouldSkipHeader(name string) bool {
	switch strings.ToLower(name) {
	case "transfer-encoding", "content-encoding", "content-length", "connection":
		return true
	default:
		return false
	}
}

func writeCORS(w http.ResponseWriter) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, User-Agent")
}

func logRequests(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		log.Printf("%s %s", r.Method, r.URL.RequestURI())
		next.ServeHTTP(w, r)
	})
}

func resolveDistDir() string {
	wd, err := os.Getwd()
	if err != nil {
		return "."
	}
	candidates := []string{
		filepath.Join(wd, "dist"),
		filepath.Join(wd, "scripts", "dist"),
		filepath.Join(filepath.Dir(wd), "dist"),
	}
	for _, c := range candidates {
		if info, err := os.Stat(c); err == nil && info.IsDir() {
			return c
		}
	}
	log.Printf("warning: dist directory not found; serving current directory")
	return wd
}

func detectLocalIP() string {
	conn, err := net.Dial("udp", "8.8.8.8:80")
	if err != nil {
		return "127.0.0.1"
	}
	defer conn.Close()
	localAddr, ok := conn.LocalAddr().(*net.UDPAddr)
	if !ok {
		return "127.0.0.1"
	}
	return localAddr.IP.String()
}

func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
