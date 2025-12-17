import json
from bs4 import BeautifulSoup
import re
import time
from datetime import datetime
from playwright.sync_api import sync_playwright


"""
DEPRECIATING BECAUSE RA IS TOO HARD TO BYPASS
Other sites might work though
"""

# test_url = "https://www.eventbrite.com/e/funkbox-mlk-2025-tickets-1143196173529?utm_experiment=test_share_listing&aff=ebdsshios"  # replace with target URL
test_url = "https://ra.co/events/2079060"
 
def wait_for_captcha_clear(page, check_interval=2, timeout=300):
    """
    Wait until CAPTCHA disappears or page navigation finishes.
    - check_interval: seconds between checks
    - timeout: maximum total time to wait
    """
    print("Waiting for CAPTCHA to be solved manually...")

    start = time.time()

    while True:
        # If timeout reached → stop waiting
        if time.time() - start > timeout:
            raise TimeoutError("CAPTCHA was not solved within timeout.")

        try:
            # 1. Detect page navigation (often happens after CAPTCHA solve)
            if page.url != page.context.pages[0].url:
                print("Detected navigation → CAPTCHA solved.")
                return True

            # 2. Detect disappearance of common CAPTCHA frames/elements
            captcha_elements = page.locator(
                """
                iframe[src*="captcha"]
                , iframe[src*="hcaptcha"]
                , iframe[src*="recaptcha"]
                , div[id*="cf-challenge"]
                , div[class*="cf-turnstile"]
                , div[data-sitekey]
                """
            )

            if captcha_elements.count() == 0:
                print("CAPTCHA elements no longer visible → continuing.")
                return True

        except TimeoutError:
            pass

        time.sleep(check_interval)


def fetch_page_after_manual_captcha(url, har_path="network.har"):
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=False)  # visible browser
        context = browser.new_context(
            record_har_path=har_path,
            record_har_content="embed",  # embed response bodies
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            )
        )

        page = context.new_page()
        page.goto(url)

        # --- Wait for manual CAPTCHA solving ---
        wait_for_captcha_clear(page)

        # --- CAPTCHA solved: extract content ---
        print("CAPTCHA cleared. Extracting content...")
        html_content = page.content()
        final_url = page.url

        context.close()
        browser.close()

        return html_content, final_url, har_path
        
        
content, final_url, har_file = fetch_page_after_manual_captcha(test_url)
print(content[:500])  # print first 500 characters of the content