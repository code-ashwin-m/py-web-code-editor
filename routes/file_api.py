from flask import Blueprint, request, jsonify
import os

file_api_bp = Blueprint("file_api", __name__)

ROOT_DIR = "/mnt/server_sdcard"  # Update as per your base directory

@file_api_bp.route("/api/create-file", methods=["POST"])
def create_file():
    data = request.get_json()
    data_path = data.get("path", "")
    data_root = data.get("root", "")
    if data_path != "/":
      root = os.path.join(ROOT_DIR, data_path)
    else:
      root = os.path.join(ROOT_DIR, data_root)
    path = os.path.join(root, data["name"])
    
    #return jsonify({"success": False, "error": path}), 400
    #print(f"path: {path}")
    try:
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "x") as f:  # Avoid overwrite
            f.write("")  # Empty file
        return jsonify({"success": True})
    except FileExistsError:
        return jsonify({"success": False, "error": "File already exists"}), 400
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@file_api_bp.route("/api/create-folder", methods=["POST"])
def create_folder():
    data = request.get_json()
    data_path = data.get("path", "")
    data_root = data.get("root", "")
    if data_path != "/":
      root = os.path.join(ROOT_DIR, data_path)
    else:
      root = os.path.join(ROOT_DIR, data_root)
    path = os.path.join(root, data["name"])
    
    #return jsonify({"success": False, "error": path}), 400
  
    print(f"path: {path}")
    try:
        os.makedirs(path, exist_ok=False)
        return jsonify({"success": True})
    except FileExistsError:
        return jsonify({"success": False, "error": "Folder already exists"}), 400
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500