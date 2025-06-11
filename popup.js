class PopupController {
  constructor() {
    this.initializeElements();
    this.loadSettings();
    this.bindEvents();
    this.checkStatus();
  }

  initializeElements() {
    this.autoScrollToggle = document.getElementById("autoScrollToggle");
    this.statusDot = document.getElementById("statusDot");
    this.statusText = document.getElementById("statusText");
    this.openShortsBtn = document.getElementById("openShortsBtn");
  }

  async loadSettings() {
    try {
      const result = await chrome.storage.sync.get(["autoScrollEnabled"]);
      this.autoScrollToggle.checked = result.autoScrollEnabled || false;
    } catch (error) {
      console.error("Error loading settings:", error);
    }
  }

  bindEvents() {
    this.autoScrollToggle.addEventListener("change", (e) => {
      this.toggleAutoScroll(e.target.checked);
    });

    this.openShortsBtn.addEventListener("click", () => {
      this.openYouTubeShorts();
    });
  }

  async toggleAutoScroll(enabled) {
    try {
      await chrome.storage.sync.set({ autoScrollEnabled: enabled });

      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (tab && tab.url && tab.url.includes("youtube.com")) {
        chrome.tabs.sendMessage(tab.id, {
          action: "toggleAutoScroll",
          enabled: enabled,
        });
      }

      this.updateStatus(enabled);
    } catch (error) {
      console.error("Error toggling auto-scroll:", error);
    }
  }

  async checkStatus() {
    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      if (!tab || !tab.url || !tab.url.includes("youtube.com")) {
        this.updateStatus(false, "Not on YouTube");
        return;
      }

      if (tab.url.includes("/shorts")) {
        const result = await chrome.storage.sync.get(["autoScrollEnabled"]);
        this.updateStatus(result.autoScrollEnabled, "Ready for Shorts");
      } else {
        this.updateStatus(false, "Navigate to Shorts");
      }
    } catch (error) {
      console.error("Error checking status:", error);
      this.updateStatus(false, "Error");
    }
  }

  updateStatus(active, message = null) {
    if (active) {
      this.statusDot.className = "status-dot active";
      this.statusText.textContent = message || "Auto-scroll active";
    } else {
      this.statusDot.className = "status-dot inactive";
      this.statusText.textContent = message || "Auto-scroll inactive";
    }
  }

  async openYouTubeShorts() {
    try {
      await chrome.tabs.create({
        url: "https://www.youtube.com/shorts",
      });
      window.close();
    } catch (error) {
      console.error("Error opening YouTube Shorts:", error);
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  new PopupController();
});
