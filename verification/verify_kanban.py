from playwright.sync_api import sync_playwright
import time
import random
import string

def verify_kanban():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        try:
            # Go to homepage
            print("Navigating to http://localhost:3000")
            page.goto("http://localhost:3000")
            page.wait_for_load_state("networkidle")
            time.sleep(2)

            # Check if we are on login page
            if "login" in page.url or page.locator("h1:has-text('JobTracker')").count() > 0:
                print("Login required.")

                # Switch to Sign Up
                signup_link = page.locator("button:text(\"Don't have an account? Sign Up\")")
                if signup_link.count() > 0:
                    print("Switching to Sign Up...")
                    signup_link.click()
                    time.sleep(1)

                # Generate random credentials
                random_suffix = ''.join(random.choices(string.ascii_lowercase + string.digits, k=6))
                email = f"testuser_{random_suffix}@example.com"
                password = "password123"
                print(f"Signing up with {email}...")

                # Sign Up Form
                page.fill("input[type='email']", email)
                page.fill("input[type='password']", password)

                # Click Create Account
                page.click("button[type='submit']")

                # Wait for navigation
                try:
                    page.wait_for_url("http://localhost:3000/", timeout=15000)
                    print("Successfully signed up and redirected.")
                except:
                    print(f"Redirection timeout or failed. Current URL: {page.url}")

            # Wait for initial load
            time.sleep(3)

            # Add a job to populate the board
            # Look for the New Job button - might be "New Job" or "+" icon
            add_job_btn = page.locator("button:has-text('New Job')")
            if add_job_btn.count() > 0:
                print("Adding a test job...")
                add_job_btn.click()
                time.sleep(1) # Wait for modal

                # Fill form in modal
                page.get_by_placeholder("e.g. Google").fill("Bolt Inc")
                page.get_by_placeholder("e.g. Software Engineer").fill("Performance Engineer")

                # Click Add Application
                page.get_by_role("button", name="Add Application").click()
                time.sleep(2)
                print("Job added.")
            else:
                print("'New Job' button not found, assuming jobs exist or UI different.")

            # Navigate to Board view if not already there
            # Screenshot showed a sidebar with "Board"
            print("Navigating to Board view...")
            board_link = page.locator("a:has-text('Board'), button:has-text('Board')")
            if board_link.count() > 0:
                board_link.first.click()
                time.sleep(3)
            else:
                print("Could not find 'Board' link in sidebar.")

            # Take screenshot of the actual Kanban board
            screenshot_path = "verification/kanban_board_view.png"
            page.screenshot(path=screenshot_path, full_page=True)
            print(f"Screenshot saved to {screenshot_path}")

        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="verification/error_final.png")
        finally:
            browser.close()

if __name__ == "__main__":
    verify_kanban()
