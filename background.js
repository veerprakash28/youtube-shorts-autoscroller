class BackgroundService {
  constructor() {
    this.init();
  }

  init() {
    chrome.runtime.onInstalled.addListener((details) => {
      if (details.reason === "install") {
        this.handleFirstInstall();
      }
    });

    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (
        changeInfo.status === "complete" &&
        tab.url &&
        tab.url.includes("youtube.com")
      ) {
        setTimeout(() => {
          this.handleYouTubeTabUpdate(tabId, tab);
        }, 1000);
      }
    });

    chrome.tabs.onActivated.addListener(async (activeInfo) => {
      try {
        const tab = await chrome.tabs.get(activeInfo.tabId);
        if (tab.url && tab.url.includes("youtube.com")) {
          setTimeout(() => {
            this.handleYouTubeTabUpdate(activeInfo.tabId, tab);
          }, 500);
        }
      } catch (error) {}
    });
  }

  async handleFirstInstall() {
    try {
      await chrome.storage.sync.set({
        autoScrollEnabled: false,
      });

      chrome.tabs.create({
        url: "https://www.youtube.com/shorts",
      });
    } catch (error) {
      console.error("Error handling first install:", error);
    }
  }

  async handleYouTubeTabUpdate(tabId, tab) {
    try {
      const result = await chrome.storage.sync.get(["autoScrollEnabled"]);

      this.sendMessageWithRetry(
        tabId,
        {
          action: "updateSettings",
          settings: result,
        },
        3
      );
    } catch (error) {
      console.error("Error handling tab update:", error);
    }
  }

  async sendMessageWithRetry(tabId, message, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        await chrome.tabs.sendMessage(tabId, message);
        return;
      } catch (error) {
        if (i === maxRetries - 1) {
          console.log(
            "Content script not ready, will retry on next interaction"
          );
        } else {
          await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)));
        }
      }
    }
  }
}

new BackgroundService();
