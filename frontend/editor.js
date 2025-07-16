
let currentEditor;
let editors = {};
let tabs = {};

function createEditor(containerId) {
  return CodeMirror(document.getElementById(containerId), {
    value: "",
    mode: "python",
    theme: "default",
    lineNumbers: true
  });
}

function addTab(filename, content) {
  if (tabs[filename]) return switchTab(filename);

  // Create tab DOM
  const tab = document.createElement("div");
  tab.className = "tab";
  tab.title = filename;

  const label = document.createElement("span");
  label.innerText = filename.split("/").pop();

  const indicator = document.createElement("span");
  indicator.className = "unsaved-indicator";
  indicator.style.display = "none"; // Hidden by default

  const closeBtn = document.createElement("span");
  closeBtn.className = "close-btn";
  closeBtn.innerText = "×";

  closeBtn.onclick = (e) => {
    e.stopPropagation(); // Prevent tab switch
    removeTab(filename);
  };

  tab.appendChild(label);
  tab.appendChild(indicator);
  tab.appendChild(closeBtn);

  tab.onclick = () => switchTab(filename);
  document.getElementById("tabs").appendChild(tab);

  // Create editor
  const container = document.createElement("div");
  container.style.display = "none";
  container.style.height = "100%";
  document.getElementById("editor").appendChild(container);

  const mode = getModeForFile(filename);
  const editor = CodeMirror(container, {
    value: content,
    mode: mode,
    theme: "material",
    lineNumbers: true
  });

  editor.on("inputRead", function (cm, change) {
    if (change.text[0].match(/[\w.]/)) {
      cm.showHint({ completeSingle: false });
    }
  });
  editor.setOption("extraKeys", {
    "Ctrl-Space": "autocomplete"
  });

  editor.getWrapperElement().style.fontSize = "12px";

  const tabData = { tab, editor, container, indicator, original: content };
  tabs[filename] = tabData;

  // Detect changes for unsaved indicator
  editor.on("change", () => {
    const isDirty = editor.getValue() !== tabData.original;
    tabData.indicator.style.display = isDirty ? "inline-block" : "none";
  });

  switchTab(filename);
}

function switchTab(filename) {
  Object.entries(tabs).forEach(([name, t]) => {
    t.container.style.display = "none";
    t.tab.classList.remove("active");
  });
  const t = tabs[filename];
  t.container.style.display = "block";
  t.tab.classList.add("active");
  t.editor.refresh();
  currentEditor = t.editor;
}

function removeTab(filename) {
  const tabData = tabs[filename];
  if (!tabData) return;

  tabData.tab.remove();
  tabData.container.remove();
  delete tabs[filename];

  // Switch to another tab if available
  const remaining = Object.keys(tabs);
  if (remaining.length) {
    switchTab(remaining[0]);
  } else {
    currentEditor = null;
  }
}


function loadFile(path) {
  fetch(`/api/load/${path}`)
    .then(res => res.json())
    .then(data => addTab(path, data.content));
}

function renderTree(items, parent) {
  // Sort: folders first, then files — each alphabetically
  items.sort((a, b) => {
    if (a.type === b.type) {
      return a.name.localeCompare(b.name);
    }
    return a.type === "folder" ? -1 : 1;
  });


  items.forEach(item => {
    
    if (item.type === "folder") {
      const wrapper = document.createElement("div");

      const header = document.createElement("div");
      header.className = "folder";

      const label = document.createElement("div");
      label.className = "folder-label";

      const toggleIcon = document.createElement("span");
      toggleIcon.className = "codicon codicon-chevron-right folder-toggle";
      // toggleIcon.innerText = "▶";

      const icon = document.createElement("span");
      icon.className = "tree-icon codicon codicon-folder";
      // icon.innerText = "📁";

      const name = document.createElement("span");
      name.innerText = item.name;

      label.appendChild(toggleIcon);
      label.appendChild(icon);
      label.appendChild(name);

      // Tools container
      const tools = document.createElement("div");
      tools.className = "folder-tools";

      const btnNewFile = document.createElement("button");
      btnNewFile.innerHTML = `<span class="codicon codicon-new-file"></span>`;

      btnNewFile.onclick = async (e) => {
        e.stopPropagation();
        const name = prompt("Enter new file name:");
        if (name && name.trim()) {
          const rootPath = localStorage.getItem("treeRoot");
          const res = await fetch("/api/create-file", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
              path: item.path, name,
              root: rootPath
            })
          });
          const result = await res.json();
          if (result.success) {
            loadTree(rootPath); // refresh view
          } else {
            alert("Error: " + result.error);
          }
        }
      };


      const btnNewFolder = document.createElement("button");
      btnNewFolder.innerHTML = `<span class="codicon codicon-new-folder"></span>`;
      btnNewFolder.onclick = async (e) => {
        e.stopPropagation();
        const name = prompt("Enter new folder name:");
        if (name && name.trim()) {
          const rootPath = localStorage.getItem("treeRoot");
          const res = await fetch("/api/create-folder", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
              path: item.path, name,
              root: rootPath
            })
          });
          const result = await res.json();
          if (result.success) {
            loadTree(rootPath); // refresh view
          } else {
            alert("Error: " + result.error);
          }
        }
      };

      tools.appendChild(btnNewFile);
      tools.appendChild(btnNewFolder);

      header.appendChild(label);
      header.appendChild(tools);
      wrapper.appendChild(header);

      // Children
      const childrenContainer = document.createElement("div");
      childrenContainer.classList.add("children");
      childrenContainer.style.display = "none";

      wrapper.appendChild(childrenContainer);
      parent.appendChild(wrapper);

      //renderTree(item.children, childrenContainer);

      // Expand/collapse + activate
      label.onclick = () => {
        const isOpen = childrenContainer.style.display === "block";

       if (!isOpen) {
         toggleIcon.className = "codicon codicon-chevron-down folder-toggle";
         childrenContainer.style.display = "block";
		  // Lazy load only if not already loaded
         if (!childrenContainer.hasChildNodes()) {
           const rootPath = localStorage.getItem("treeRoot");
        
           fetch("/api/tree", {
             method: "POST",
             headers: { "Content-Type": "application/json" },
             body: JSON.stringify({
               path: item.path,
               root: rootPath
             })
	        })
	        .then(res => res.json())
	        .then(data => {
             renderTree(data, childrenContainer);
           });
         }
       } else {
         toggleIcon.className = "codicon codicon-chevron-right folder-toggle";
         childrenContainer.style.display = "none";
       }

        activateFolder(header);
      }
    }

    if (item.type === "file") {
      const el = document.createElement("div");
      el.className = "file";

      const iconEl = document.createElement("span");
      const { icon, color } = getFileIconInfo(item.name);
      
      iconEl.className = `tree-icon codicon ${icon} ${color}`;
      // icon.innerText = "📄";

      const name = document.createElement("span");
      name.innerText = item.name;

      const status = document.createElement("span");
      status.className = "git-status";
      
      if (item.git_status === "modified") {
        status.innerText = "M";
        status.classList.add("modified");
      } else if (item.git_status === "added" || item.git_status === "untracked") {
        status.innerText = "A";
        status.classList.add("added");
      } else if (item.git_status === "deleted") {
        status.innerText = "D";
        status.classList.add("deleted");
      } else {
        status.style.display = "none";
      }

 
      el.appendChild(iconEl);
      el.appendChild(name);
      el.appendChild(status);
      parent.appendChild(el);


      el.onclick = () => {
        loadFile(item.path); // existing logic

        // Auto-hide sidebar on mobile
        if (isMobileView()) {
          //document.getElementById("sidebar").classList.add("hidden");
        }
      };
    }
  });
}

function loadTree(rootPath = "") {
  fetch("/api/tree", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: rootPath,
          root: rootPath
        })
	 })
	 .then(res => res.json())
	 .then(data => {
      const treeView = document.getElementById("treeView");
      treeView.innerHTML = "";
      renderTree(data, treeView);
    });
}

function loadBranchInfo(rootPath) {
  fetch(`/api/branch/${rootPath}`)
    .then(res => res.json())
    .then(data => {
      document.getElementById("branch-info").innerText = data.branch;
    })
    .catch(() => {
      document.getElementById("branch-info").innerText = "unknown";
    });
}

// Toggle sidebar & refresh CodeMirror layout
const sidebar = document.getElementById("sidebar");
const toggleBtn = document.getElementById("toggleSidebar");

toggleBtn.onclick = () => {
  sidebar.classList.toggle("hidden");
  toggleBtn.classList.toggle("show");

  setTimeout(() => {
    if (currentEditor) currentEditor.refresh();
  }, 310);
};


document.getElementById("saveBtn").onclick = () => {
  if (!currentEditor) return;
  const activeTab = Object.entries(tabs).find(([_, t]) => t.editor === currentEditor);
  if (activeTab) saveTab(activeTab[0], activeTab[1]);
};

document.getElementById("saveAllBtn").onclick = () => {
  Object.entries(tabs).forEach(([filename, tabData]) => {
    const isDirty = tabData.editor.getValue() !== tabData.original;
    if (isDirty) saveTab(filename, tabData);
  });
};

function saveTab(filename, tabData) {
  const content = tabData.editor.getValue();

  fetch("/api/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename, content })
  }).then(res => res.json()).then(resp => {
    if (resp.success) {
      tabData.original = content;
      tabData.indicator.style.display = "none";
    }
  }).catch(err => {
    console.error("Failed to save:", err);
  });
}

function activateFolder(selected) {
  document.querySelectorAll(".folder").forEach(f => {
    if (f !== selected) f.classList.remove("active");
  });
  selected.classList.toggle("active");
}

function isMobileView() {
  return window.innerWidth <= 768;
}

function getModeForFile(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  switch (ext) {
    case 'py': return 'python';
    case 'js': return 'javascript';
    case 'html': return 'htmlmixed';
    case 'css': return 'css';
    case 'json': return { name: 'javascript', json: true };
    case 'xml': return 'xml';
    case 'md': return 'markdown';
    case 'sh': return 'shell';
    case 'txt': return 'null'; // plain text
    default: return 'null';
  }
}

function getFileIconInfo(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  switch (ext) {
    case 'js': return { icon: 'codicon-symbol-variable', color: 'icon-yellow' };
    case 'ts': return { icon: 'codicon-symbol-namespace', color: 'icon-blue' };
    case 'json': return { icon: 'codicon-json', color: 'icon-orange' };
    case 'py': return { icon: 'codicon-symbol-function', color: 'icon-green' };
    case 'html': return { icon: 'codicon-code', color: 'icon-orange' };
    case 'css': return { icon: 'codicon-symbol-key', color: 'icon-purple' };
    case 'md': return { icon: 'codicon-markdown', color: 'icon-gray' };
    case 'sh': return { icon: 'codicon-terminal', color: 'icon-gray' };
    case 'yml':
    case 'yaml': return { icon: 'codicon-settings', color: 'icon-purple' };
    case 'txt': return { icon: 'codicon-text-size', color: 'icon-white' };
    case 'xml': return { icon: 'codicon-file-code', color: 'icon-gray' };
    case 'db':
    case 'sql': return { icon: 'codicon-database', color: 'icon-red' };
    case 'java': return { icon: 'codicon-symbol-class', color: 'icon-red' };
    case 'c':
    case 'cpp': return { icon: 'codicon-symbol-structure', color: 'icon-blue' };
    default: return { icon: 'codicon-file', color: 'icon-gray' };
  }
}

function loadFolders(path = "") {
  fetch("/api/folders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: path })
  })
  .then(res => res.json())
  .then(data => {
    const body = document.getElementById("folderPickerBody");
    body.innerHTML = "";

    if (path) {
      const upRow = document.createElement("div");
      upRow.className = "m-folder-row";
      upRow.innerHTML = `<div class="folder-label">🔼 ..</div>`;
      upRow.onclick = () => {
        const upPath = path.split("/").slice(0, -1).join("/");
        loadFolders(upPath);
      };
      body.appendChild(upRow);
    }

    data.folders.forEach(folder => {
      const row = document.createElement("div");
      row.className = "m-folder-row";

      const label = document.createElement("div");
      label.className = "m-folder-label";
      label.innerHTML = `📁 ${folder.name}`;

      const actions = document.createElement("div");
      actions.className = "m-folder-actions";

      const selectBtn = document.createElement("button");
      selectBtn.innerText = "Select";
      selectBtn.onclick = (e) => {
        e.stopPropagation();
        setTreeRoot(folder.path);
        closeFolderPicker();
      };

      row.onclick = () => loadFolders(folder.path);

      actions.appendChild(selectBtn);
      row.appendChild(label);
      row.appendChild(actions);
      body.appendChild(row);
    });
  });
}

function setTreeRoot(path) {
  localStorage.setItem("treeRoot", path);
  loadTree(path);
  loadBranchInfo(path)
}

window.onload = () => {
  const rootPath = localStorage.getItem("treeRoot");
  
  loadTree(rootPath);
  loadBranchInfo(rootPath);
  
  // Auto-collapse sidebar on small screens
  if (window.innerWidth <= 768) {
    document.getElementById("sidebar").classList.add("hidden");
  }

  document.getElementById("rootNewFile").onclick = async () => {
    const name = prompt("Enter new file name:");
    if (name && name.trim()) {
      const rootPath = localStorage.getItem("treeRoot");
      const res = await fetch("/api/create-file", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          path: "/", name,
          root: rootPath
        })
      });
      const result = await res.json();
      if (result.success) {
        loadTree(rootPath);
      } else {
        alert("Error: " + result.error);
      }
    }
  };

  document.getElementById("rootNewFolder").onclick = async () => {
    const name = prompt("Enter new folder name:");
    if (name && name.trim()) {
      const rootPath = localStorage.getItem("treeRoot");
      const res = await fetch("/api/create-folder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          path: "/", name,
          root: rootPath
        })
      });
      const result = await res.json();
      if (result.success) {
        loadTree(rootPath);
      } else {
        alert("Error: " + result.error);
      }
    }
  };
  
  document.getElementById("browseBtn").onclick = () => {
    const modal = document.getElementById("folderPickerModal");
    modal.classList.remove("hidden");
    loadFolders("");
    
  };
  
  document.getElementById("closeBrowseBtn").onclick = () => {
    closeFolderPicker();
  };
};

function closeFolderPicker(){
  document.getElementById("folderPickerModal").classList.add("hidden");
}

function setFullHeight() {
  const vh = window.innerHeight * 0.01;
  document.documentElement.style.setProperty('--vh', `${vh}px`);
  document.querySelectorAll('.full-height').forEach(el => {
    el.style.height = `calc(var(--vh, 1vh) * 100)`;
  });
}

window.addEventListener("load", setFullHeight);
window.addEventListener("resize", setFullHeight);