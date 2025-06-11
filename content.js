class YouTubeShortsAutoScroller {
  constructor() {
    this.isEnabled = false;
    this.currentVideoElement = null;
    this.currentVideoSrc = null;
    this.observer = null;
    this.checkInterval = null;
    this.scrollCooldown = false;
    this.lastScrollTime = 0;
    this.videoEndedCount = 0;
    this.maxEndedCount = 2;

    this.init();
  }

  async init() {
    await this.loadSettings();

    // Listen for messages from popup and background
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === "toggleAutoScroll") {
        this.toggleAutoScroll(message.enabled);
      } else if (message.action === "updateSettings") {
        this.isEnabled = message.settings.autoScrollEnabled || false;
        if (this.isEnabled && this.isShortsPage()) {
          this.startMonitoring();
        }
      }
    });

    // Start monitoring if on shorts page and enabled
    if (this.isShortsPage() && this.isEnabled) {
      // Delay to ensure page is fully loaded
      setTimeout(() => this.startMonitoring(), 2000);
    }

    // Monitor URL changes for SPA navigation
    this.observeUrlChanges();

    // Monitor DOM changes for new video elements
    this.observeDOMChanges();
  }

  async loadSettings() {
    try {
      const result = await chrome.storage.sync.get(["autoScrollEnabled"]);
      this.isEnabled = result.autoScrollEnabled || false;
    } catch (error) {
      console.error("Error loading settings:", error);
    }
  }

  toggleAutoScroll(enabled) {
    this.isEnabled = enabled;

    // Save setting
    chrome.storage.sync.set({ autoScrollEnabled: enabled });

    if (enabled && this.isShortsPage()) {
      this.startMonitoring();
      this.showNotification("Auto-scroll enabled");
    } else {
      this.stopMonitoring();
      this.showNotification("Auto-scroll disabled");
    }
  }

  isShortsPage() {
    return (
      window.location.pathname.includes("/shorts") ||
      window.location.href.includes("youtube.com/shorts")
    );
  }

  startMonitoring() {
    if (!this.isEnabled || !this.isShortsPage()) return;

    this.stopMonitoring(); // Clear any existing monitoring

    console.log("YouTube Shorts Auto-Scroll: Starting monitoring");

    // Multiple detection methods for better reliability
    this.startVideoDetection();
    this.startPeriodicCheck();
    this.startScrollDetection();
  }

  startVideoDetection() {
    // Method 1: Direct video element monitoring
    this.checkInterval = setInterval(() => {
      this.detectAndMonitorVideo();
    }, 500);
  }

  startPeriodicCheck() {
    // Method 2: Periodic status checking
    this.statusInterval = setInterval(() => {
      this.checkCurrentVideoStatus();
    }, 1000);
  }

  startScrollDetection() {
    // Method 3: Monitor scroll position changes
    let lastScrollTop = window.scrollY;
    this.scrollMonitor = setInterval(() => {
      const currentScrollTop = window.scrollY;
      if (Math.abs(currentScrollTop - lastScrollTop) > 100) {
        // Significant scroll detected, reset video tracking
        this.resetVideoTracking();
        lastScrollTop = currentScrollTop;
      }
    }, 500);
  }

  detectAndMonitorVideo() {
    try {
      // Find the currently visible video element
      const videos = document.querySelectorAll("video");
      let activeVideo = null;

      for (const video of videos) {
        const rect = video.getBoundingClientRect();
        const isVisible = rect.top < window.innerHeight && rect.bottom > 0;
        const hasValidSrc = video.src || video.currentSrc;

        if (isVisible && hasValidSrc && video.duration > 0) {
          activeVideo = video;
          break;
        }
      }

      if (activeVideo && activeVideo !== this.currentVideoElement) {
        this.setupVideoMonitoring(activeVideo);
      }
    } catch (error) {
      console.error("Error detecting video:", error);
    }
  }

  setupVideoMonitoring(video) {
    // Clean up previous monitoring
    if (this.currentVideoElement) {
      this.currentVideoElement.removeEventListener(
        "ended",
        this.handleVideoEnd.bind(this)
      );
      this.currentVideoElement.removeEventListener(
        "timeupdate",
        this.handleTimeUpdate.bind(this)
      );
    }

    this.currentVideoElement = video;
    this.currentVideoSrc = video.src || video.currentSrc;
    this.videoEndedCount = 0;

    console.log(
      "YouTube Shorts Auto-Scroll: Monitoring new video",
      this.currentVideoSrc
    );

    // Add event listeners
    video.addEventListener("ended", this.handleVideoEnd.bind(this));
    video.addEventListener("timeupdate", this.handleTimeUpdate.bind(this));
  }

  handleVideoEnd() {
    console.log("YouTube Shorts Auto-Scroll: Video ended event triggered");
    this.videoEndedCount++;

    if (this.videoEndedCount >= this.maxEndedCount) {
      this.initiateScroll();
    }
  }

  handleTimeUpdate() {
    if (!this.currentVideoElement) return;

    const video = this.currentVideoElement;
    const timeRemaining = video.duration - video.currentTime;

    // Check if video is near end (within 0.5 seconds)
    if (timeRemaining <= 0.5 && timeRemaining > 0) {
      this.videoEndedCount++;
      if (this.videoEndedCount >= this.maxEndedCount) {
        this.initiateScroll();
      }
    }
  }

  checkCurrentVideoStatus() {
    try {
      if (!this.currentVideoElement) {
        this.detectAndMonitorVideo();
        return;
      }

      const video = this.currentVideoElement;

      // Check if video has ended or is very close to ending
      if (
        video.ended ||
        (video.duration > 0 && video.currentTime >= video.duration - 0.3)
      ) {
        this.videoEndedCount++;

        if (this.videoEndedCount >= this.maxEndedCount) {
          this.initiateScroll();
        }
      }

      // Reset counter if video is playing normally
      if (video.currentTime < video.duration - 1) {
        this.videoEndedCount = 0;
      }
    } catch (error) {
      console.error("Error checking video status:", error);
    }
  }

  initiateScroll() {
    const now = Date.now();

    // Prevent rapid scrolling
    if (this.scrollCooldown || now - this.lastScrollTime < 3000) {
      return;
    }

    console.log("YouTube Shorts Auto-Scroll: Initiating scroll to next video");

    this.scrollCooldown = true;
    this.lastScrollTime = now;
    this.videoEndedCount = 0;

    // Reset cooldown after delay
    setTimeout(() => {
      this.scrollCooldown = false;
    }, 3000);

    this.scrollToNext();
  }

  scrollToNext() {
    try {
      setTimeout(() => {
        this.simulateKeyPress("ArrowDown");
      }, 1000);

      setTimeout(() => {
        this.resetVideoTracking();
      }, 2000);
    } catch (error) {
      console.error("Error scrolling to next video:", error);
    }
  }

  simulateKeyPress(key) {
    try {
      const events = ["keydown", "keyup"];

      events.forEach((eventType) => {
        const event = new KeyboardEvent(eventType, {
          key: key,
          code: key === "ArrowDown" ? "ArrowDown" : key,
          keyCode: key === "ArrowDown" ? 40 : 0,
          which: key === "ArrowDown" ? 40 : 0,
          bubbles: true,
          cancelable: true,
        });

        document.dispatchEvent(event);
        document.body.dispatchEvent(event);

        if (document.activeElement) {
          document.activeElement.dispatchEvent(event);
        }
      });
    } catch (error) {
      console.error("Error simulating key press:", error);
    }
  }

  resetVideoTracking() {
    this.currentVideoElement = null;
    this.currentVideoSrc = null;
    this.videoEndedCount = 0;
  }

  stopMonitoring() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }

    if (this.statusInterval) {
      clearInterval(this.statusInterval);
      this.statusInterval = null;
    }

    if (this.scrollMonitor) {
      clearInterval(this.scrollMonitor);
      this.scrollMonitor = null;
    }

    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }

    if (this.currentVideoElement) {
      this.currentVideoElement.removeEventListener(
        "ended",
        this.handleVideoEnd.bind(this)
      );
      this.currentVideoElement.removeEventListener(
        "timeupdate",
        this.handleTimeUpdate.bind(this)
      );
    }

    this.resetVideoTracking();
    console.log("YouTube Shorts Auto-Scroll: Monitoring stopped");
  }

  observeUrlChanges() {
    let currentUrl = window.location.href;

    const urlObserver = new MutationObserver(() => {
      if (window.location.href !== currentUrl) {
        currentUrl = window.location.href;

        setTimeout(() => {
          if (this.isShortsPage() && this.isEnabled) {
            this.startMonitoring();
          } else {
            this.stopMonitoring();
          }
        }, 1000);
      }
    });

    urlObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  observeDOMChanges() {
    const domObserver = new MutationObserver((mutations) => {
      if (!this.isEnabled || !this.isShortsPage()) return;

      let hasNewVideo = false;
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            if (node.tagName === "VIDEO" || node.querySelector("video")) {
              hasNewVideo = true;
            }
          }
        });
      });

      if (hasNewVideo) {
        setTimeout(() => this.detectAndMonitorVideo(), 500);
      }
    });

    domObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  showNotification(message) {
    // Remove existing notifications
    const existing = document.querySelectorAll(
      ".yt-shorts-autoscroll-notification"
    );
    existing.forEach((el) => el.remove());

    // Create new notification
    const notification = document.createElement("div");
    notification.className = "yt-shorts-autoscroll-notification";
    notification.textContent = message;

    document.body.appendChild(notification);

    // Remove after animation completes
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 3000);
  }
}

// Initialize when page is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    new YouTubeShortsAutoScroller();
  });
} else {
  new YouTubeShortsAutoScroller();
}
