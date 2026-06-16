import requests
from bs4 import BeautifulSoup
import os

# Add any public CMU-Q URLs you want to scrape here
urls = [
    "https://qatar.cmu.edu/academics",
    "https://qatar.cmu.edu/student-experience",  # student-life redirects to a 404
    # add more as needed
]

os.makedirs("scraped", exist_ok=True)

headers = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

for url in urls:
    response = requests.get(url, headers=headers, timeout=30)
    soup = BeautifulSoup(response.text, "html.parser")

    # Remove clutter
    for tag in soup(["script", "style", "nav", "footer", "header"]):
        tag.decompose()

    text = soup.get_text(separator="\n", strip=True)

    # Save each page as its own .txt file
    filename = url.replace("https://", "").replace("/", "_") + ".txt"
    with open(f"scraped/{filename}", "w") as f:
        f.write(f"SOURCE: {url}\n---\n{text}")

    print(f"Done: {url}")
