import os
import zipfile
import json
from pathlib import Path

def build_extension():
    # Define paths
    project_root = Path(__file__).resolve().parent.parent
    src_dir = project_root / 'src'
    dist_dir = project_root / 'dist'
    
    # Ensure dist directory exists
    dist_dir.mkdir(exist_ok=True)
    
    # Get version from manifest.json
    manifest_path = src_dir / 'manifest.json'
    if not manifest_path.exists():
        print("Error: manifest.json not found in src/")
        return
        
    try:
        with open(manifest_path, 'r', encoding='utf-8') as f:
            manifest = json.load(f)
            version = manifest.get('version', '1.0.0')
    except Exception as e:
        print(f"Error reading manifest: {e}")
        version = 'unknown'

    # Define output zip name
    zip_name = f"commitdsa-v{version}.zip"
    zip_path = dist_dir / zip_name
    
    print(f"Building {zip_name} from src/ ...")
    
    # Create Zip File
    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk(src_dir):
            for file in files:
                file_path = Path(root) / file
                # Skip OS generated files
                if file == '.DS_Store':
                    continue
                    
                # Calculate relative path for zip internal structure
                arcname = file_path.relative_to(src_dir)
                zipf.write(file_path, arcname)
                
    print(f"Build successful! Saved to: {zip_path}")

if __name__ == "__main__":
    build_extension()
