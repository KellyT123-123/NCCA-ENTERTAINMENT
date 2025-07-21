#!/bin/bash

# Create backup directory
mkdir -p backup_pdfs

# Function to watermark a PDF
watermark_pdf() {
    local input_file="$1"
    local backup_file="backup_pdfs/$(basename "$input_file")"
    
    echo "Processing: $input_file"
    
    # Create backup
    cp "$input_file" "$backup_file"
    
    # Create temporary watermarked file
    temp_file="${input_file}.temp"
    
    # Add watermark using Python script
    python3 add_watermark.py "$input_file" "$temp_file"
    
    if [ $? -eq 0 ]; then
        # Replace original with watermarked version
        mv "$temp_file" "$input_file"
        echo "✓ Watermarked: $input_file"
    else
        echo "✗ Failed to watermark: $input_file"
        # Clean up temp file if it exists
        [ -f "$temp_file" ] && rm "$temp_file"
    fi
}

# Watermark all pitch deck files in root directory
for pdf in *pitch_deck*.pdf; do
    if [ -f "$pdf" ]; then
        watermark_pdf "$pdf"
    fi
done

# Watermark all pitch deck files in pitch-decks directory
if [ -d "pitch-decks" ]; then
    for pdf in pitch-decks/*pitch*.pdf; do
        if [ -f "$pdf" ]; then
            watermark_pdf "$pdf"
        fi
    done
fi

echo "Watermarking complete!"
