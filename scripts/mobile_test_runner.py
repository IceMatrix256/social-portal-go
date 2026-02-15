import subprocess
import time
import os

# Configuration
BASE_URL = "http://127.0.0.1:5174"
ADB = "adb"
OUTPUT_DIR = "mobile_tests"
OS_OUTPUT_DIR = f"/Users/panda/.gemini/antigravity/scratch/social-portal/{OUTPUT_DIR}"

# Ensure output directory exists
if not os.path.exists(OS_OUTPUT_DIR):
    os.makedirs(OS_OUTPUT_DIR)

def run_adb(command):
    cmd = f"{ADB} {command}"
    print(f"Running: {cmd}")
    subprocess.run(cmd, shell=True, check=True)

def open_url(url):
    # Force Chrome to open the URL
    run_adb(f'shell am start -n com.android.chrome/com.google.android.apps.chrome.Main -d "{url}"')

def take_screenshot(name):
    filename = f"{name}.png"
    local_path = os.path.join(OS_OUTPUT_DIR, filename)
    remote_path = f"/sdcard/{filename}"
    
    print(f"Capturing {name}...")
    run_adb(f"shell screencap -p {remote_path}")
    run_adb(f"pull {remote_path} {local_path}")
    run_adb(f"shell rm {remote_path}")
    print(f"Saved to {local_path}")

def run_test(name, route, wait_time=8):
    print(f"\n--- Testing {name} ---")
    url = f"{BASE_URL}{route}"
    open_url(url)
    print(f"Waiting {wait_time}s for load...")
    time.sleep(wait_time)
    take_screenshot(name)
    # Scroll down a bit to see content?
    # run_adb("shell input swipe 500 1000 500 500 300")
    # time.sleep(1)
    # take_screenshot(f"{name}_scrolled")

def main():
    print("Starting Mobile Battery Tests via ADB...")
    
    # wake up device
    run_adb("shell input keyevent KEYCODE_WAKEUP")
    
    # 1. Dashboard
    run_test("01_dashboard", "/", wait_time=5)
    
    # 2. Mastodon (checking Retry/User-Agent fix)
    run_test("02_mastodon", "/?network=mastodon", wait_time=10)

    # 3. Imgur (checking scraping fix)
    run_test("03_imgur", "/?network=imgur", wait_time=10)

    # 4. Nostr (checking timeout fix)
    run_test("04_nostr", "/?network=nostr", wait_time=10)

if __name__ == "__main__":
    main()
