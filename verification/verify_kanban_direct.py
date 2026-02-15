from playwright.sync_api import sync_playwright
import time
import random
import string

def verify_kanban_direct():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        try:
            print("Navigating to http://localhost:3000/kanban")
            page.goto("http://localhost:3000/kanban")
            page.wait_for_load_state("networkidle")
            time.sleep(2)

            # Check if we got redirected to login
            if "login" in page.url:
                print("Redirected to login. Signing up...")

                # Switch to Sign Up
                signup_link = page.locator("button:text(\"Don't have an account? Sign Up\")")
                if signup_link.count() > 0:
                    signup_link.click()
                    time.sleep(1)

                random_suffix = ''.join(random.choices(string.ascii_lowercase + string.digits, k=6))
                email = f"testuser_{random_suffix}@example.com"
                password = "password123"

                page.fill("input[type='email']", email)
                page.fill("input[type='password']", password)
                page.click("button[type='submit']")

                # Wait for redirect back to intended page or dashboard
                page.wait_for_url("http://localhost:3000/**", timeout=15000)
                print(f"Logged in. Current URL: {page.url}")

            # Force navigation to /kanban if not there
            if "/kanban" not in page.url:
                print("Navigating explicitly to /kanban...")
                page.goto("http://localhost:3000/kanban")
                page.wait_for_load_state("networkidle")
                time.sleep(3)

            # Check for "Application Board" title
            if page.locator("text=Application Board").count() > 0:
                print("SUCCESS: Kanban Board rendered.")
            else:
                print("WARNING: 'Application Board' text not found.")

            # Take screenshot
            screenshot_path = "verification/kanban_direct_view.png"
            page.screenshot(path=screenshot_path, full_page=True)
            print(f"Screenshot saved to {screenshot_path}")

        except Exception as e:
            print(f"Error: {e}")
        finally:
            browser.close()

if __name__ == "__main__":
    verify_kanban_direct()
