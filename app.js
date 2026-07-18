document.addEventListener("DOMContentLoaded", function () {
  const body = document.body;

  /* =========================================================
     SCROLL REVEAL
  ========================================================= */

  const revealElements = document.querySelectorAll(
    ".reveal, .statement .container, .card, .framework-card, .platform-window, .founder-grid > div"
  );

  if ("IntersectionObserver" in window) {
    const revealObserver = new IntersectionObserver(
      function (entries, observer) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.14,
        rootMargin: "0px 0px -40px 0px"
      }
    );

    revealElements.forEach(function (element) {
      revealObserver.observe(element);
    });
  } else {
    revealElements.forEach(function (element) {
      element.classList.add("visible");
    });
  }

  /* =========================================================
     BEGIN JOURNEY MODAL
  ========================================================= */

  const beginButtons = document.querySelectorAll(
    'a[href="#story"].button, .hero-buttons .button:first-child'
  );

  const journeyModal = document.getElementById("journeyModal");
  const closeModal = document.getElementById("closeModal");

  function openJourneyModal(event) {
    if (!journeyModal) {
      return;
    }

    event.preventDefault();

    journeyModal.classList.add("open");
    body.classList.add("modal-open");
    journeyModal.setAttribute("aria-hidden", "false");
  }

  function closeJourneyModal() {
    if (!journeyModal) {
      return;
    }

    journeyModal.classList.remove("open");
    body.classList.remove("modal-open");
    journeyModal.setAttribute("aria-hidden", "true");
  }

  beginButtons.forEach(function (button) {
    button.addEventListener("click", openJourneyModal);
  });

  if (closeModal) {
    closeModal.addEventListener("click", closeJourneyModal);
  }

  if (journeyModal) {
    journeyModal.addEventListener("click", function (event) {
      if (event.target === journeyModal) {
        closeJourneyModal();
      }
    });
  }

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
      closeJourneyModal();
    }
  });

  /* =========================================================
     JOURNEY OPTION BUTTONS
  ========================================================= */

  const journeyOptions = document.querySelectorAll(
    ".journey-buttons button"
  );

  journeyOptions.forEach(function (button) {
    button.addEventListener("click", function () {
      const selectedPath = button.textContent.trim();

      journeyOptions.forEach(function (option) {
        option.classList.remove("selected");
      });

      button.classList.add("selected");

      button.textContent = "Selected: " + selectedPath;

      setTimeout(function () {
        closeJourneyModal();

        const platformSection = document.getElementById("platform");

        if (platformSection) {
          platformSection.scrollIntoView({
            behavior: "smooth",
            block: "start"
          });
        }
      }, 700);
    });
  });

  /* =========================================================
     NAVIGATION SHADOW
  ========================================================= */

  const navbar = document.querySelector(".navbar");

  function updateNavigation() {
    if (!navbar) {
      return;
    }

    if (window.scrollY > 20) {
      navbar.style.boxShadow =
        "0 10px 35px rgba(23, 33, 43, 0.08)";
    } else {
      navbar.style.boxShadow = "none";
    }
  }

  updateNavigation();

  window.addEventListener("scroll", updateNavigation, {
    passive: true
  });

  /* =========================================================
     SMOOTH INTERNAL LINKS
  ========================================================= */

  const internalLinks = document.querySelectorAll(
    'a[href^="#"]:not([href="#"])'
  );

  internalLinks.forEach(function (link) {
    link.addEventListener("click", function (event) {
      const targetId = link.getAttribute("href");
      const targetElement = document.querySelector(targetId);

      if (!targetElement) {
        return;
      }

      if (
        link.matches('a[href="#story"].button') ||
        link.matches(".hero-buttons .button:first-child")
      ) {
        return;
      }

      event.preventDefault();

      targetElement.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    });
  });

  /* =========================================================
     DASHBOARD STATUS
  ========================================================= */

  const status = document.querySelector(".status");

  if (status) {
    const statusMessages = [
      "Analyzing Reflections...",
      "Recognizing Patterns...",
      "Building Your Profile...",
      "Profile Ready"
    ];

    let statusIndex = 0;

    const statusTimer = setInterval(function () {
      statusIndex += 1;

      if (statusIndex >= statusMessages.length) {
        clearInterval(statusTimer);
        status.textContent =
          statusMessages[statusMessages.length - 1];
        return;
      }

      status.textContent = statusMessages[statusIndex];
    }, 1500);
  }

  /* =========================================================
     DASHBOARD PROGRESS ANIMATION
  ========================================================= */

  const progressBars = document.querySelectorAll(".fill");
  const platformWindow = document.querySelector(".platform-window");

  if (
    platformWindow &&
    progressBars.length &&
    "IntersectionObserver" in window
  ) {
    progressBars.forEach(function (bar) {
      bar.style.animationPlayState = "paused";
    });

    const progressObserver = new IntersectionObserver(
      function (entries, observer) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            progressBars.forEach(function (bar) {
              bar.style.animationPlayState = "running";
            });

            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.25
      }
    );

    progressObserver.observe(platformWindow);
  }

  /* =========================================================
     SPIRAL PARALLAX
  ========================================================= */

  const spiral = document.querySelector(".spiral");

  function moveSpiral() {
    if (!spiral) {
      return;
    }

    const movement = Math.min(window.scrollY * 0.08, 65);

    spiral.style.marginTop = movement + "px";
  }

  window.addEventListener("scroll", moveSpiral, {
    passive: true
  });

  /* =========================================================
     CARD POINTER EFFECT
  ========================================================= */

  const interactiveCards = document.querySelectorAll(
    ".card, .framework-card, .panel"
  );

  interactiveCards.forEach(function (card) {
    card.addEventListener("mousemove", function (event) {
      const rect = card.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      const rotateX =
        ((y - rect.height / 2) / rect.height) * -2;
      const rotateY =
        ((x - rect.width / 2) / rect.width) * 2;

      card.style.transform =
        "perspective(900px) rotateX(" +
        rotateX +
        "deg) rotateY(" +
        rotateY +
        "deg) translateY(-5px)";
    });

    card.addEventListener("mouseleave", function () {
      card.style.transform = "";
    });
  });

  /* =========================================================
     FINAL SECTION STAR MOVEMENT
  ========================================================= */

  const stars = document.querySelector(".background-stars");

  function moveStars() {
    if (!stars) {
      return;
    }

    stars.style.backgroundPosition =
      window.scrollY * 0.02 +
      "px " +
      window.scrollY * 0.04 +
      "px";
  }

  window.addEventListener("scroll", moveStars, {
    passive: true
  });
});
/* Creative Intelligence Hero 2.0 interaction */

document.addEventListener("DOMContentLoaded", () => {
  const visual = document.querySelector(".ci2-visual");
  const archetypes = document.querySelectorAll(".ci2-archetype");

  if (!visual || archetypes.length === 0) {
    return;
  }

  archetypes.forEach((archetype) => {
    const name = archetype.dataset.archetype;

    archetype.addEventListener("mouseenter", () => {
      visual.dataset.active = name;
      archetype.classList.add("is-active");
    });

    archetype.addEventListener("mouseleave", () => {
      delete visual.dataset.active;
      archetype.classList.remove("is-active");
    });

    archetype.addEventListener("focus", () => {
      visual.dataset.active = name;
      archetype.classList.add("is-active");
    });

    archetype.addEventListener("blur", () => {
      delete visual.dataset.active;
      archetype.classList.remove("is-active");
    });
  });
});
