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

  const editor = CodeMirror(container, {
    value: content,
    mode: "python",
    theme: "material",
    lineNumbers: true
  });
  
  editor.on("inputRead", function(cm, change) {
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
      toggleIcon.className = "folder-toggle";
      toggleIcon.innerText = "▶";

      const icon = document.createElement("span");
      icon.className = "tree-icon";
      icon.innerText = "📁";

      const name = document.createElement("span");
      name.innerText = item.name;

      label.appendChild(toggleIcon);
      label.appendChild(icon);
      label.appendChild(name);

      // Tools container
      const tools = document.createElement("div");
      tools.className = "folder-tools";

      const btnNewFile = document.createElement("button");
      btnNewFile.innerText = "+File";
      
      btnNewFile.onclick = async (e) => {
  e.stopPropagation();
  const name = prompt("Enter new file name:");
  if (name && name.trim()) {
    const res = await fetch("/api/create-file", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: item.path, name })
    });
    const result = await res.json();
    if (result.success) {
      loadTree(); // refresh view
    } else {
      alert("Error: " + result.error);
    }
  }
};


      const btnNewFolder = document.createElement("button");
      btnNewFolder.innerText = "+Folder";
      btnNewFolder.onclick = async (e) => {
  e.stopPropagation();
  const name = prompt("Enter new folder name:");
  if (name && name.trim()) {
    const res = await fetch("/api/create-folder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: item.path, name })
    });
    const result = await res.json();
    if (result.success) {
      loadTree(); // refresh view
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
      childrenContainer.style.paddingLeft = "20px";
      childrenContainer.style.display = "none";

      wrapper.appendChild(childrenContainer);
      parent.appendChild(wrapper);

      renderTree(item.children, childrenContainer);

      // Expand/collapse + activate
      label.onclick = () => {
        const isOpen = childrenContainer.style.display === "block";
        childrenContainer.style.display = isOpen ? "none" : "block";
        toggleIcon.innerText = isOpen ? "▶" : "▼";
        activateFolder(header);
      };
    }

    if (item.type === "file") {
      const el = document.createElement("div");
      el.className = "file";

      const icon = document.createElement("span");
      icon.className = "tree-icon";
      icon.innerText = "📄";

      const name = document.createElement("span");
      name.innerText = item.name;

      el.appendChild(icon);
      el.appendChild(name);
      parent.appendChild(el);

      el.onclick = () => loadFile(item.path);
    }
  });
}

function loadTree() {
  fetch("/api/tree")
    .then(res => res.json())
    .then(data => {
      const treeView = document.getElementById("treeView");
      treeView.innerHTML = "";
      renderTree(data, treeView);
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

window.onload = () => {
  loadTree();

  // Auto-collapse sidebar on small screens
  if (window.innerWidth <= 768) {
    document.getElementById("sidebar").classList.add("hidden");
  }

  document.getElementById("rootNewFile").onclick = async () => {
  const name = prompt("Enter new file name:");
  if (name && name.trim()) {
    const res = await fetch("/api/create-file", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: "/", name })
    });
    const result = await res.json();
    if (result.success) {
      loadTree();
    } else {
      alert("Error: " + result.error);
    }
  }
};

document.getElementById("rootNewFolder").onclick = async () => {
  const name = prompt("Enter new folder name:");
  if (name && name.trim()) {
    const res = await fetch("/api/create-folder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: "/", name })
    });
    const result = await res.json();
    if (result.success) {
      loadTree();
    } else {
      alert("Error: " + result.error);
    }
  }
};

};