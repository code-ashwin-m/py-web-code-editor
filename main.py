import os
from flask import Flask, request, jsonify, send_from_directory
from routes.file_api import file_api_bp
from git import Repo, InvalidGitRepositoryError, NoSuchPathError

app = Flask(__name__, static_folder="frontend")
app.register_blueprint(file_api_bp)

CODE_DIR = "/mnt/server_sdcard/Python/code-editor"
#CODE_DIR = "/mnt/server_sdcard/Python/airline-inventory-app"
BASE_DIR = "/mnt/server_sdcard"
CODE_DIR = BASE_DIR

os.makedirs(CODE_DIR, exist_ok=True)

def get_git_status_map(repo_path):
    """Returns a map of file path → git status"""
    status_map = {}
    try:
       repo = Repo(repo_path)
    except (InvalidGitRepositoryError, NoSuchPathError):
       return status_map

    # Get staged, unstaged, untracked using porcelain output
    for line in repo.git.status('--porcelain').splitlines():
        code = line[:2].strip()
        path = line[3:].strip()

        # Normalize path
        full_path = os.path.normpath(os.path.join(repo_path, path))
        
        if code == 'M':
            status_map[full_path] = 'modified'
        elif code in {'A', '??'}:
            status_map[full_path] = 'added'
        elif code == 'D':
            status_map[full_path] = 'deleted'
        else:
            status_map[full_path] = 'modified'  # fallback

    return status_map

def list_directory(path, git_status_map):
    items = []
    for name in os.listdir(path):
        full_path = os.path.join(path, name)
        rel_path = os.path.relpath(full_path, BASE_DIR)
        if os.path.isdir(full_path):
            items.append({
                "type": "folder",
                "name": name,
                "path": rel_path,
                "children": True
            })
        else:
            items.append({
                "type": "file",
                "name": name,
                "path": rel_path,
                "git_status": git_status_map.get(full_path)
            })
    return items

@app.route("/api/tree", methods=["POST"])
def get_tree():
    data = request.get_json()
    rel_path = data.get("path", "")
    root_path = data.get("root", "")
    
    path = os.path.join(BASE_DIR, rel_path)
    root_dir = os.path.join(BASE_DIR, root_path)
    
    status_map = get_git_status_map(root_dir)

    tree_data = list_directory(path, status_map)
    return jsonify(tree_data)
  
@app.route("/api/load/<path:filename>")
def load_code(filename):
    try:
        full_path = os.path.join(BASE_DIR, filename)
        with open(full_path) as f:
            return jsonify(content=f.read())
    except FileNotFoundError:
        return jsonify(error="File not found"), 404

@app.route("/api/save", methods=["POST"])
def save_code():
    data = request.json
    filename = data["filename"]
    content = data["content"]
    with open(os.path.join(CODE_DIR, filename), "w") as f:
        f.write(content)
    return jsonify(success=True)

@app.route("/api/branch/<path:root>")
def api_git_branch(root):
    try:
        root_dir = os.path.join(BASE_DIR, root)
        repo = Repo(root_dir)
        branch = repo.active_branch.name
        return jsonify({"branch": branch})
    except Exception as e:
        return jsonify({"branch": "unknown"})

@app.route("/api/folders", methods=["POST"])
def list_folders():
    
    data = request.get_json()
    rel_path = data.get("path", "")
    abs_path = os.path.abspath(os.path.join(BASE_DIR, rel_path))

    # prevent access outside base
    if not abs_path.startswith(BASE_DIR):
        return jsonify({"folders": []}), 403

    try:
        folders = []
        for name in sorted(os.listdir(abs_path)):
            full = os.path.join(abs_path, name)
            if os.path.isdir(full):
                folders.append({
                    "name": name,
                    "path": os.path.relpath(full, BASE_DIR)
                })
        return jsonify({"folders": folders})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
  
@app.route("/", defaults={"path": "index.html"})
@app.route("/<path:path>")
def static_files(path):
    return send_from_directory("frontend", path)

if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5001)