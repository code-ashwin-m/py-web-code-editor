import os
from flask import Flask, request, jsonify, send_from_directory
from routes.file_api import file_api_bp
from git import Repo, InvalidGitRepositoryError, NoSuchPathError

app = Flask(__name__, static_folder="frontend")
app.register_blueprint(file_api_bp)

BASE_DIR = "/mnt/server_sdcard"
CODE_DIR = BASE_DIR  # Single consistent path
os.makedirs(CODE_DIR, exist_ok=True)


def get_git_status_map(repo_path):
    """Return map of full file path → git status."""
    try:
        repo = Repo(repo_path)
    except (InvalidGitRepositoryError, NoSuchPathError):
        return {}

    status_map = {}
    for line in repo.git.status('--porcelain').splitlines():
        code = line[:2].strip()
        rel_path = line[3:].strip()
        full_path = os.path.normpath(os.path.join(repo_path, rel_path))

        if code == 'M':
            status = 'modified'
        elif code in {'A', '??'}:
            status = 'added'
        elif code == 'D':
            status = 'deleted'
        else:
            status = 'modified'

        status_map[full_path] = status

    return status_map


def list_directory(path, status_map):
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
                "git_status": status_map.get(full_path)
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
    return jsonify(list_directory(path, status_map))


@app.route("/api/load/<path:filename>")
def load_code(filename):
    full_path = os.path.join(BASE_DIR, filename)
    if not os.path.exists(full_path):
        return jsonify(error="File not found"), 404

    with open(full_path) as f:
        return jsonify(content=f.read())


@app.route("/api/save", methods=["POST"])
def save_code():
    data = request.json
    filename = data["filename"]
    content = data["content"]
    full_path = os.path.join(BASE_DIR, filename)

    os.makedirs(os.path.dirname(full_path), exist_ok=True)
    with open(full_path, "w") as f:
        f.write(content)

    return jsonify(success=True)


@app.route("/api/branch/<path:root>")
def api_git_branch(root):
    try:
        repo = Repo(os.path.join(BASE_DIR, root))
        return jsonify({"branch": repo.active_branch.name})
    except Exception:
        return jsonify({"branch": "unknown"})


@app.route("/api/folders", methods=["POST"])
def list_folders():
    data = request.get_json()
    rel_path = data.get("path", "")
    abs_path = os.path.abspath(os.path.join(BASE_DIR, rel_path))

    if not abs_path.startswith(BASE_DIR):
        return jsonify({"folders": []}), 403

    try:
        folders = [{
            "name": name,
            "path": os.path.relpath(os.path.join(abs_path, name), BASE_DIR)
        } for name in sorted(os.listdir(abs_path)) if os.path.isdir(os.path.join(abs_path, name))]

        return jsonify({"folders": folders})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/", defaults={"path": "index.html"})
@app.route("/<path:path>")
def static_files(path):
    return send_from_directory("frontend", path)


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5001)