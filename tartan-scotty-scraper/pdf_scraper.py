import pdfplumber
import os

pdf_folder = "pdfs"  # put your downloaded PDFs in this folder
os.makedirs("scraped", exist_ok=True)

for filename in os.listdir(pdf_folder):
    if filename.endswith(".pdf"):
        with pdfplumber.open(f"{pdf_folder}/{filename}") as pdf:
            all_text = ""
            for page in pdf.pages:
                all_text += page.extract_text() + "\n"

        output_name = filename.replace(".pdf", ".txt")
        with open(f"scraped/{output_name}", "w") as f:
            f.write(f"SOURCE: {filename}\n---\n{all_text}")

        print(f"Done: {filename}")
