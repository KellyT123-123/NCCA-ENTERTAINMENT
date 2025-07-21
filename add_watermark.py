#!/usr/bin/env python3
import os
import sys
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
from reportlab.lib.colors import lightgrey
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from PyPDF2 import PdfReader, PdfWriter
import io

def create_watermark():
    """Create a watermark PDF"""
    packet = io.BytesIO()
    can = canvas.Canvas(packet, pagesize=letter)
    
    # Set up watermark text
    watermark_text = "Property of NCCA ENTERTAINMENT INC. Do not duplicate or distribute"
    
    # Set font and color
    can.setFont("Helvetica", 12)
    can.setFillColor(lightgrey)
    can.setFillAlpha(0.5)  # Make it semi-transparent
    
    # Add watermark text at bottom of page
    can.drawString(50, 30, watermark_text)
    
    # Add watermark text at top of page
    can.drawString(50, 750, watermark_text)
    
    can.save()
    packet.seek(0)
    return packet

def add_watermark_to_pdf(input_path, output_path):
    """Add watermark to a PDF file"""
    try:
        # Create watermark
        watermark_packet = create_watermark()
        watermark_pdf = PdfReader(watermark_packet)
        watermark_page = watermark_pdf.pages[0]
        
        # Read the input PDF
        input_pdf = PdfReader(input_path)
        output_pdf = PdfWriter()
        
        # Add watermark to each page
        for page in input_pdf.pages:
            page.merge_page(watermark_page)
            output_pdf.add_page(page)
        
        # Write the output PDF
        with open(output_path, 'wb') as output_file:
            output_pdf.write(output_file)
        
        print(f"Watermark added to {input_path} -> {output_path}")
        return True
    except Exception as e:
        print(f"Error processing {input_path}: {str(e)}")
        return False

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python3 add_watermark.py input.pdf output.pdf")
        sys.exit(1)
    
    input_file = sys.argv[1]
    output_file = sys.argv[2]
    
    if not os.path.exists(input_file):
        print(f"Input file {input_file} does not exist")
        sys.exit(1)
    
    success = add_watermark_to_pdf(input_file, output_file)
    sys.exit(0 if success else 1)
