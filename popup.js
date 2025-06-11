class PopupController {
  constructor() {
    this.activeTimeInterval = null;
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

    // Add smooth hover effects
    this.addHoverEffects();
  }

  addHoverEffects() {
    const cards = document.querySelectorAll(".feature-card, .status-card");
    cards.forEach((card) => {
      card.addEventListener("mouseenter", (e) => {
        e.target.style.transform = "translateY(-2px)";
      });

      card.addEventListener("mouseleave", (e) => {
        e.target.style.transform = "translateY(0)";
      });
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
      this.showToggleFeedback(enabled);
    } catch (error) {
      console.error("Error toggling auto-scroll:", error);
    }
  }

  showToggleFeedback(enabled) {
    const slider = document.querySelector(".toggle-slider");
    slider.style.transform = "scale(1.1)";
    setTimeout(() => {
      slider.style.transform = "scale(1)";
    }, 200);
  }

  async checkStatus() {
    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      if (!tab || !tab.url || !tab.url.includes("youtube.com")) {
        this.updateStatus(
          false,
          "Not on YouTube",
          "Navigate to YouTube to get started"
        );
        return;
      }

      if (tab.url.includes("/shorts")) {
        const result = await chrome.storage.sync.get(["autoScrollEnabled"]);
        if (result.autoScrollEnabled) {
          this.updateStatus(
            true,
            "Active on Shorts",
            "Auto-scrolling enabled and ready"
          );
        } else {
          this.updateStatus(
            false,
            "Ready for Shorts",
            "Enable auto-scroll to start"
          );
        }
      } else {
        this.updateStatus(
          false,
          "Navigate to Shorts",
          "Click the button below to open Shorts"
        );
      }
    } catch (error) {
      console.error("Error checking status:", error);
      this.updateStatus(false, "Connection Error", "Please refresh the page");
    }
  }

  updateStatus(active, title, description) {
    const statusClasses = active ? "status-dot active" : "status-dot inactive";
    this.statusDot.className = statusClasses;

    this.statusText.style.opacity = "0";
    setTimeout(() => {
      this.statusText.textContent =
        description || (active ? "Auto-scroll active" : "Auto-scroll inactive");
      this.statusText.style.opacity = "1";
    }, 150);

    const statusTitle = document.querySelector(".status-title");
    if (statusTitle) {
      statusTitle.textContent = title || "Extension Status";
    }
  }

  async openYouTubeShorts() {
    try {
      const originalText = this.openShortsBtn.innerHTML;
      this.openShortsBtn.innerHTML = `
        <div class="btn-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 12a9 9 0 11-6.219-8.56"/>
          </svg>
        </div>
        <span>Opening...</span>
      `;

      this.openShortsBtn.disabled = true;

      await chrome.tabs.create({
        url: "https://www.youtube.com/shorts",
      });
      window.close();
    } catch (error) {
      console.error("Error opening YouTube Shorts:", error);

      this.openShortsBtn.disabled = false;
      this.openShortsBtn.innerHTML = originalText;
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const popup = new PopupController();
  window.addEventListener("beforeunload", () => {
    popup.destroy();
  });
});

document.addEventListener("DOMContentLoaded", () => {
  const elements = document.querySelectorAll(
    ".status-card, .feature-card, .btn-primary, .stats-section"
  );
  elements.forEach((el, index) => {
    el.style.opacity = "0";
    el.style.transform = "translateY(20px)";

    setTimeout(() => {
      el.style.transition = "all 0.6s cubic-bezier(0.4, 0, 0.2, 1)";
      el.style.opacity = "1";
      el.style.transform = "translateY(0)";
    }, index * 100);
  });
});
