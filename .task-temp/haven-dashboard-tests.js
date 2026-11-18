
      const routes = [
        "/", "/login", "/login/password", "/register", "/dashboard", "/hostels",
        "/room-availability", "/students", "/visitors", "/complaints", "/maintenance",
        "/mess", "/staff", "/bookings", "/invoices", "/my-profile",
        "/hostels/00000000-0000-4000-8000-000000000011/buildings",
        "/hostels/00000000-0000-4000-8000-000000000011/buildings/00000000-0000-4000-8000-000000000301/floors",
        "/hostels/00000000-0000-4000-8000-000000000011/buildings/00000000-0000-4000-8000-000000000301/floors/00000000-0000-4000-8000-000000000401/rooms",
        "/invoices/00000000-0000-4000-8000-0000000001301",
      ];
      const widths = [1440, 375];
      const results = document.querySelector("#results");
      let failures = 0;

      function report(label, passed, detail = "") {
        const item = document.createElement("li");
        item.className = passed ? "pass" : "fail";
        item.textContent = `${passed ? "PASS" : "FAIL"} ${label}${detail ? ` — ${detail}` : ""}`;
        results.append(item);
        if (!passed) failures += 1;
      }

      function rgbParts(color) {
        const parts = color.match(/[\d.]+/g)?.map(Number);
        return parts?.length >= 3 ? parts.slice(0, 3) : null;
      }

      function luminance(color) {
        const rgb = rgbParts(color);
        if (!rgb) return Number.NaN;
        const channels = rgb.map((channel) => {
          const value = channel / 255;
          return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
        });
        return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
      }

      function contrastRatio(foreground, background) {
        const first = luminance(foreground);
        const second = luminance(background);
        return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
      }

      function effectiveBackground(element, doc) {
        let background = rgbParts(doc.defaultView.getComputedStyle(doc.body).backgroundColor) ?? [255, 255, 255];
        const ancestors = [];
        for (let current = element; current && current !== doc.body; current = current.parentElement) ancestors.push(current);
        for (const current of ancestors.reverse()) {
          const parts = doc.defaultView.getComputedStyle(current).backgroundColor.match(/[\d.]+/g)?.map(Number);
          if (!parts || parts.length < 3) continue;
          const alpha = parts.length > 3 ? parts[3] : 1;
          background = parts.slice(0, 3).map((channel, index) => Math.round(channel * alpha + background[index] * (1 - alpha)));
        }
        return `rgb(${background.join(", ")})`;
      }

      function hasTrafficLightBackground(color) {
        const rgb = rgbParts(color);
        if (!rgb) return false;
        const [red, green, blue] = rgb.map((value) => value / 255);
        const high = Math.max(red, green, blue);
        const low = Math.min(red, green, blue);
        const delta = high - low;
        if (delta < 0.08) return false;
        const saturation = delta / (1 - Math.abs(2 * ((high + low) / 2) - 1));
        let hue = 0;
        if (high === red) hue = 60 * (((green - blue) / delta) % 6);
        else if (high === green) hue = 60 * ((blue - red) / delta + 2);
        else hue = 60 * ((red - green) / delta + 4);
        if (hue < 0) hue += 360;
        return saturation > 0.3 && (hue <= 10 || (hue >= 35 && hue <= 65) || (hue >= 80 && hue <= 165));
      }

      function waitForFrame(frame) {
        return new Promise((resolve) => {
          const timeout = setTimeout(() => resolve("timeout"), 9000);
          frame.onload = () => {
            clearTimeout(timeout);
            setTimeout(() => resolve("loaded"), 250);
          };
          frame.onerror = () => {
            clearTimeout(timeout);
            resolve("error");
          };
        });
      }

      async function run() {
        document.cookie = "hms-theme=dark; Path=/; SameSite=Lax";
        for (const width of widths) {
          for (const route of routes) {
            const frame = document.createElement("iframe");
            frame.title = `${route} at ${width}px`;
            frame.style.width = `${width}px`;
            frame.style.height = "900px";
            document.body.append(frame);
            try {
              frame.contentWindow.localStorage.setItem("hms-theme", "dark");
            } catch (error) {
              report(`${route} at ${width}px can seed dark theme storage`, false, error.message);
            }
            const loaded = waitForFrame(frame);
            frame.src = `${route}${route.includes("?") ? "&" : "?"}layoutCheck=${Date.now()}`;
            const status = await loaded;

            if (status !== "loaded") {
              report(`${route} at ${width}px loads`, false, status);
              frame.remove();
              continue;
            }

            let doc;
            try {
              doc = frame.contentDocument;
            } catch {
              report(`${route} at ${width}px inspection`, false, "iframe is not same-origin");
              frame.remove();
              continue;
            }

            if (!doc || (route.startsWith("/") && route !== "/" && route !== "/login" &&
                route !== "/register" && route !== "/login/password" &&
                new URL(frame.contentWindow.location.href).pathname === "/login")) {
              report(`${route} at ${width}px renders`, false, "protected route redirected to /login; session required");
              frame.remove();
              continue;
            }

            const demoChecks = new Map([
              ["/dashboard", [[".dashboard-stat", 8], [".dashboard-activity-panel > .dashboard-feed-list > li", 6], [".dashboard-notifications__list > li", 5], [".dashboard-hostel-table tbody tr", 4], [".dashboard-revenue-trend canvas[data-points='6']", 1]]],
              ["/hostels", [[".hostel-directory-grid > li", 4]]],
              ["/room-availability", [[".demo-room-grid > li", 60]]],
              ["/students", [[".student-directory-grid > li", 10]]],
              ["/visitors", [[".visitor-log-table tbody tr", 6]]],
              ["/complaints", [[".operations-record-list > li", 8]]],
              ["/maintenance", [[".operations-record-list > li", 7]]],
              ["/mess", [[".operations-record-list > li", 21]]],
              ["/staff", [[".operations-record-list > li", 8]]],
              ["/bookings", [[".booking-review-list > li", 6]]],
              ["/invoices", [[".booking-review-list > li", 10]]],
            ]);
            const routePath = new URL(frame.contentWindow.location.href).pathname;
            const lightTheme = doc.documentElement.dataset.theme === "light";
            const lightBodyBackground = doc.defaultView.getComputedStyle(doc.documentElement).backgroundColor;
            report(`${routePath} starts in light theme with saved dark preference`, lightTheme &&
              doc.defaultView.getComputedStyle(doc.body).backgroundColor === lightBodyBackground,
              `theme=${doc.documentElement.dataset.theme}; body=${doc.defaultView.getComputedStyle(doc.body).backgroundColor}; light=${lightBodyBackground}`);
            const expectedTitleColor = lightTheme ? "rgb(31, 29, 27)" : "rgb(243, 238, 228)";
            const expectedHeadingColor = lightTheme ? "rgb(74, 69, 64)" : "rgb(170, 166, 155)";
            const expectedPanelTitleColor = lightTheme ? "rgb(31, 29, 27)" : "rgb(243, 238, 228)";
            const expectedEyebrowColor = lightTheme ? "rgb(160, 82, 45)" : "rgb(208, 177, 132)";
            const expectedTableColor = lightTheme ? "rgb(122, 74, 53)" : "rgb(208, 177, 132)";
            const pageTitles = [...doc.querySelectorAll(".page-content h1")];
            const titleResults = pageTitles.map((title) => {
              const style = doc.defaultView.getComputedStyle(title);
              const top = title.getBoundingClientRect().top;
              const maxSize = width <= 640 ? 28 : 36;
              return style.color === expectedTitleColor && Number(style.fontWeight) >= 700 &&
                Number.parseFloat(style.fontSize) <= maxSize && title.scrollHeight <= title.clientHeight + 1 && top >= 0 &&
                contrastRatio(style.color, effectiveBackground(title, doc)) >= 4.5;
            });
            report(`${routePath} page titles meet the responsive size, color, contrast, and visibility rules`,
              pageTitles.length > 0 && titleResults.every(Boolean), `${titleResults.filter(Boolean).length} / ${pageTitles.length}`);
            const pageHeadings = [...doc.querySelectorAll(".page-content > .page-heading")];
            report(`${routePath} page heading blocks have a 20px rounded edge`, pageHeadings.length > 0 &&
              pageHeadings.every((heading) => Number.parseFloat(doc.defaultView.getComputedStyle(heading).borderTopLeftRadius) >= 20),
            `${pageHeadings.length} blocks`);
            const sectionLabels = [...doc.querySelectorAll(".page-content .auth-eyebrow, .page-content .dashboard-panel__eyebrow")];
            report(`${routePath} section labels use the accent`, sectionLabels.every((label) =>
              doc.defaultView.getComputedStyle(label).color === expectedEyebrowColor), `${sectionLabels.length} labels`);
            const subtitles = [...doc.querySelectorAll(".page-content .page-heading__subtitle, .page-content .dashboard-intro, .page-content .booking-review-intro, .page-content .hostel-directory-intro, .page-content .student-directory-intro")];
            const subtitleResults = subtitles.map((subtitle) => {
              const color = doc.defaultView.getComputedStyle(subtitle).color;
              return color === expectedHeadingColor && contrastRatio(color, effectiveBackground(subtitle, doc)) >= 4.5;
            });
            report(`${routePath} subtitles use a readable secondary color`, subtitleResults.every(Boolean),
              subtitles.length ? `${subtitleResults.filter(Boolean).length} / ${subtitles.length}` : "no subtitle on this view");
            const cardTitles = [...doc.querySelectorAll(".page-content h2, .page-content h3")];
            const cardTitleResults = cardTitles.map((title) => {
              const style = doc.defaultView.getComputedStyle(title);
              const color = style.color;
              return color === expectedPanelTitleColor && Number(style.fontWeight) >= 700 &&
                Number.parseFloat(style.fontSize) >= 18 && Number.parseFloat(style.fontSize) <= 20 &&
                Number.parseFloat(style.borderTopLeftRadius) >= 20 &&
                contrastRatio(color, effectiveBackground(title, doc)) >= 4.5;
            });
            report(`${routePath} card titles use rounded blocks, strong type, and readable contrast`, cardTitleResults.every(Boolean),
              `${cardTitleResults.filter(Boolean).length} / ${cardTitles.length}`);
            const tableHeaders = [...doc.querySelectorAll(".page-content th")];
            const tableHeaderResults = tableHeaders.map((header) => {
              const color = doc.defaultView.getComputedStyle(header).color;
              return color === expectedTableColor && contrastRatio(color, effectiveBackground(header, doc)) >= 4.5;
            });
            report(`${routePath} table headers use a readable brown accent`, tableHeaderResults.every(Boolean),
              tableHeaders.length ? `${tableHeaderResults.filter(Boolean).length} / ${tableHeaders.length}` : "no table on this view");
            const pillTones = ["up", "down", "neutral", "warn"];
            const expectedPillColors = {
              up: "rgb(40, 98, 58)", down: "rgb(158, 47, 42)",
              neutral: "rgb(112, 64, 46)", warn: "rgb(118, 84, 0)",
            };
            const pills = [...doc.querySelectorAll(".pill")];
            const pillResults = pills.map((pill) => {
              const tones = pillTones.filter((tone) => pill.classList.contains(`pill--${tone}`));
              const style = doc.defaultView.getComputedStyle(pill);
              const contrast = contrastRatio(style.color, style.backgroundColor);
              return { valid: tones.length === 1 && style.color === expectedPillColors[tones[0]] && contrast >= 4.5, contrast };
            });
            report(`${routePath} status pills use one allowed tone with 4.5:1 contrast`,
              pillResults.every((result) => result.valid),
              pills.length ? `${pillResults.filter((result) => result.valid).length} / ${pills.length}; minimum contrast ${Math.min(...pillResults.map((result) => result.contrast)).toFixed(2)}:1` : "no pills on this view");
            const coloredBackgroundsOutsidePills = [...doc.querySelectorAll("body *")].filter((element) =>
              !element.closest(".pill") && hasTrafficLightBackground(doc.defaultView.getComputedStyle(element).backgroundColor));
            report(`${routePath} has no green/red/amber background outside status pills`,
              coloredBackgroundsOutsidePills.length === 0,
              coloredBackgroundsOutsidePills.slice(0, 4).map((element) => `${element.tagName.toLowerCase()}.${String(element.className).slice(0, 32)}`).join(", "));
            const statCardsByRoute = new Map([
              ["/dashboard", ".dashboard-stat"],
              ["/room-availability", ".demo-room-grid__kpis > div"],
              ["/complaints", ".demo-operation-kpis > div"],
              ["/maintenance", ".demo-operation-kpis > div"],
              ["/mess", ".demo-operation-kpis > div"],
              ["/invoices", ".demo-invoice-kpis > div"],
            ]);
            const statSelector = statCardsByRoute.get(routePath);
            if (statSelector) {
              const cards = [...doc.querySelectorAll(statSelector)];
              const iconChecks = cards.map((card) => {
                const tiles = card.querySelectorAll(":scope > .stat-icon-tile");
                const icons = tiles[0]?.querySelectorAll("svg") ?? [];
                const tileStyle = tiles[0] ? doc.defaultView.getComputedStyle(tiles[0]) : null;
                const tileRect = tiles[0]?.getBoundingClientRect();
                return tiles.length === 1 && icons.length === 1 && Boolean(tiles[0].dataset.icon) &&
                  tileStyle?.color === "rgb(250, 246, 240)" &&
                  /160,\s*82,\s*45/.test(tileStyle?.backgroundImage ?? "") &&
                  /122,\s*74,\s*53/.test(tileStyle?.backgroundImage ?? "") &&
                  tileRect?.width === 36 && tileRect?.height === 36;
              });
              const labelsAndIcons = cards.map((card) => ({
                label: card.querySelector("dt")?.innerText.trim(),
                icon: card.querySelector(":scope > .stat-icon-tile")?.dataset.icon,
              }));
              const distinctLabelsHaveDistinctIcons = labelsAndIcons.every((item, index) =>
                labelsAndIcons.slice(0, index).every((previous) =>
                  previous.label === item.label || previous.icon !== item.icon));
              report(`${routePath} KPI cards have compact dark-brown tiles with white SVG icons`, cards.length > 0 && iconChecks.every(Boolean),
                `${iconChecks.filter(Boolean).length} / ${cards.length} cards`);
              report(`${routePath} different KPI labels use different icons`,
                cards.length > 0 && distinctLabelsHaveDistinctIcons, `${labelsAndIcons.length} labels checked`);

              if (routePath === "/dashboard") {
                const buildingCard = cards.find((card) => card.querySelector("dt")?.innerText.trim() === "Buildings");
                const buildingPath = buildingCard?.querySelector(".stat-icon-tile svg path")?.getAttribute("d");
                const overviewPath = doc.querySelector('.protected-sidebar__navigation a[href="/dashboard"] svg path')?.getAttribute("d");
                report("Buildings KPI icon is distinct from Overview navigation icon",
                  Boolean(buildingPath) && Boolean(overviewPath) && buildingPath !== overviewPath &&
                    buildingCard?.querySelector(".stat-icon-tile")?.dataset.icon !== "overview");
              }
            }
            if (doc.querySelector("[data-demo-data='true']") && demoChecks.has(routePath)) {
              if (routePath === "/dashboard") await new Promise((resolve) => setTimeout(resolve, 1000));
              for (const [selector, minimum] of demoChecks.get(routePath)) {
                const count = doc.querySelectorAll(selector).length;
                report(`${routePath} demo row count for ${selector}`, count >= minimum, `${count} / ${minimum}`);
              }
              if (routePath === "/dashboard") {
                const sparklineCount = doc.querySelectorAll(".dashboard-stat__sparkline").length;
                const trendCount = doc.querySelectorAll(".dashboard-stat__trend").length;
                const counters = [...doc.querySelectorAll(".dashboard-stat dd span[aria-label]")];
                const countersComplete = counters.length === 8 && counters.every((counter) => counter.textContent.trim() === counter.getAttribute("aria-label"));
                const ring = doc.querySelector(".dashboard-occupancy-ring__arc");
                const dashOffset = ring ? Number.parseFloat(doc.defaultView.getComputedStyle(ring).strokeDashoffset) : Number.NaN;
                const canvas = doc.querySelector(".dashboard-revenue-trend canvas");
                report("dashboard has one sparkline and trend pill per stat", sparklineCount === 8 && trendCount === 8,
                  `${sparklineCount} sparklines / ${trendCount} trend pills`);
                report("dashboard counters reach their labelled values", countersComplete, `${counters.filter((counter) => counter.textContent.trim() === counter.getAttribute("aria-label")).length} / 8 complete`);
                const trendPills = [...doc.querySelectorAll(".dashboard-stat__trend")];
                report("every dashboard trend pill has one semantic tone", trendPills.length === 8 && trendPills.every((pill) => pillTones.filter((tone) => pill.classList.contains(`pill--${tone}`)).length === 1), `${trendPills.length} trend pills`);
                report("dashboard occupancy ring reaches the live 85.8% offset", Number.isFinite(dashOffset) && Math.abs(dashOffset - 14.2) < 0.2,
                  `strokeDashoffset ${dashOffset}`);
                report("dashboard trend canvas stays within its container", Boolean(canvas) && canvas.getBoundingClientRect().width <= canvas.parentElement.getBoundingClientRect().width + 1,
                  canvas ? `${canvas.getBoundingClientRect().width}px / ${canvas.parentElement.getBoundingClientRect().width}px` : "canvas missing");
              }
              if (routePath === "/room-availability") {
                const values = [...doc.querySelectorAll(".demo-room-grid__kpis dd")].map((item) => Number(item.innerText.replace(/\D/g, "")));
                report("room availability KPIs match the 60-cell grid", values.length === 3 && values[0] === 60 && values[1] + values[2] === values[0], values.join(" + "));
              }
              if (routePath === "/invoices") {
                const values = [...doc.querySelectorAll(".demo-invoice-kpis dd")].map((item) => Number(item.innerText.replace(/[^\d]/g, "").slice(0, -2)));
                report("invoice KPIs are present and derived from invoice rows", values.length === 4 && values[0] === 1845200 && values[1] === 855200 && values[2] === 990000 && values[3] === 335000, values.join(" / "));
              }
              const emptyDemoMessages = [...doc.querySelectorAll(".dashboard-panel__empty, .dashboard-message")]
                .filter((element) => /^No\b/i.test((element.innerText || "").trim()));
              report(`${routePath} has no empty-data message while demo data is active`, emptyDemoMessages.length === 0,
                emptyDemoMessages.map((element) => (element.innerText || "").trim()).join("; "));
            }

            const actualWidth = doc.documentElement.clientWidth;
            const scrollWidth = Math.max(doc.documentElement.scrollWidth, doc.body.scrollWidth);
            report(`${route} at ${width}px has no horizontal page overflow`, scrollWidth <= actualWidth,
              `scrollWidth ${scrollWidth}px / viewport ${actualWidth}px`);

            const offenders = [...doc.body.querySelectorAll("*")].filter((element) => {
              const rect = element.getBoundingClientRect();
              const style = doc.defaultView.getComputedStyle(element);
              return !element.closest(".ambient-layer") && rect.width > 0 &&
                style.position !== "fixed" && rect.right > actualWidth + 1;
            }).slice(0, 3);
            report(`${route} at ${width}px has no element beyond the viewport`, offenders.length === 0,
              offenders.map((element) => `${element.tagName.toLowerCase()}.${String(element.className).slice(0, 40)}`).join(", "));

            const sidebar = doc.querySelector(".protected-sidebar");
            if (sidebar) {
              const navigation = sidebar.querySelector(".protected-sidebar__navigation");
              const navigationLinks = [...(navigation?.querySelectorAll(".ui-navigation__link") ?? [])];
              const iconPaths = navigationLinks.map((link) => link.querySelector("svg path")?.getAttribute("d"));
              report(`${route} sidebar navigation icons are all distinct`,
                navigationLinks.length === 14 && iconPaths.every(Boolean) && new Set(iconPaths).size === navigationLinks.length,
                `${new Set(iconPaths.filter(Boolean)).size} distinct icons / ${navigationLinks.length} links`);
              const sidebarBackground = doc.defaultView.getComputedStyle(sidebar).backgroundColor;
              const inactiveLinks = navigationLinks.filter((link) => !link.hasAttribute("aria-current"));
              const inactiveContrast = inactiveLinks.map((link) => contrastRatio(
                doc.defaultView.getComputedStyle(link.querySelector(".ui-navigation__label")).color, sidebarBackground));
              const expectedSidebarLinkColor = lightTheme ? "rgb(122, 74, 53)" : "rgb(170, 166, 155)";
              const expectedActiveSidebarColor = lightTheme ? "rgb(160, 82, 45)" : "rgb(208, 177, 132)";
              const expectedSidebarBackground = lightTheme ? "rgb(245, 240, 234)" : "rgb(25, 26, 23)";
              const inactiveColorsMatch = inactiveLinks.every((link) => {
                const linkColor = doc.defaultView.getComputedStyle(link).color;
                const labelColor = doc.defaultView.getComputedStyle(link.querySelector(".ui-navigation__label")).color;
                return linkColor === expectedSidebarLinkColor && labelColor === linkColor;
              });
              const activeLink = navigation?.querySelector(".ui-navigation__link[aria-current='page']");
              report(`${route} inactive sidebar icons and labels match the selected theme with 4.5:1 contrast`,
                inactiveColorsMatch && inactiveContrast.every((ratio) => ratio >= 4.5),
                `minimum contrast ${inactiveContrast.length ? Math.min(...inactiveContrast).toFixed(2) : "n/a"}:1`);
              report(`${route} active sidebar item uses the accent`,
                !activeLink || doc.defaultView.getComputedStyle(activeLink).color === expectedActiveSidebarColor);
              report(`${route} sidebar links remain keyboard tabbable`,
                navigationLinks.length === 14 && navigationLinks.every((link) => link.tabIndex === 0),
                `${navigationLinks.filter((link) => link.tabIndex === 0).length} / ${navigationLinks.length}`);
              report(`${route} sidebar surface matches the selected theme`, sidebarBackground === expectedSidebarBackground, sidebarBackground);
              const lastLink = navigation?.querySelector(".ui-navigation__link:last-of-type");
              if (navigation && lastLink) {
                const overflowY = doc.defaultView.getComputedStyle(navigation).overflowY;
                report(`${route} sidebar navigation scrolls vertically`, overflowY === "auto", overflowY);
                navigation.scrollTop = navigation.scrollHeight;
                sidebar.scrollTop = sidebar.scrollHeight;
                const navRect = navigation.getBoundingClientRect();
                const lastRect = lastLink.getBoundingClientRect();
                report(`${route} at ${width}px last nav item is reachable`,
                  lastRect.top >= navRect.top - 1 && lastRect.bottom <= navRect.bottom + 1,
                  lastLink.textContent.trim());
              }
            }

            const orphanCandidates = [...doc.body.querySelectorAll("body *")].filter((element) => {
              const rect = element.getBoundingClientRect();
              const style = doc.defaultView.getComputedStyle(element);
              const text = (element.innerText || "").trim();
              return style.position === "fixed" && rect.width < 120 && rect.height < 80 && /issue|^[01]$|^x$/i.test(text);
            });
            report(`${route} at ${width}px orphan widget cluster absent`, orphanCandidates.length === 0,
              orphanCandidates.map((element) => element.innerText.trim()).join(", "));
            const fieldControls = [...doc.querySelectorAll("form input:not([type='hidden']):not([type='checkbox']):not([type='radio']), form select, form textarea")];
            const fieldProblems = [];
            const fieldRows = new Map();
            for (const control of fieldControls) {
              const style = doc.defaultView.getComputedStyle(control);
              const controlHeight = control.offsetHeight;
              if (control.tagName === "TEXTAREA" ? controlHeight < 96 : controlHeight !== 44) {
                fieldProblems.push(`${control.name || control.tagName}: height ${controlHeight}px`);
              }
              const field = control.parentElement;
              if (field && Math.abs(control.getBoundingClientRect().width - field.clientWidth) > 1) {
                fieldProblems.push(`${control.name || control.tagName}: width differs from field`);
              }
              const grid = field?.parentElement;
              if (grid && doc.defaultView.getComputedStyle(grid).display === "grid") {
                const top = field.getBoundingClientRect().top;
                const key = `${field.parentElement === grid ? grid.className : "grid"}:${Math.round(top)}`;
                const row = fieldRows.get(key) ?? [];
                row.push(control.getBoundingClientRect().top);
                fieldRows.set(key, row);
              }
            }
            for (const row of fieldRows.values()) {
              if (row.length > 1 && Math.max(...row) - Math.min(...row) > 1) fieldProblems.push("controls in a grid row are not aligned");
            }
            report(`${routePath} form field system`, fieldProblems.length === 0,
              `${fieldControls.length} controls checked; ${fieldProblems.slice(0, 3).join(", ") || "all heights and widths match"}`);
            if (routePath === "/hostels") {
              const hostelForm = doc.querySelector(".hostel-create-form");
              if (hostelForm) {
                const name = hostelForm.querySelector('[name="name"]');
                const code = hostelForm.querySelector('[name="code"]');
                const address = hostelForm.querySelector('[name="address"]');
                const nameField = name?.closest(".ui-field");
                const codeField = code?.closest(".ui-field");
                const addressField = address?.closest(".ui-field");
                const nameRect = nameField?.getBoundingClientRect();
                const codeRect = codeField?.getBoundingClientRect();
                const addressRect = addressField?.getBoundingClientRect();
                const gridWidth = addressField?.parentElement?.clientWidth ?? 0;
                const desktopAligned = width <= 639 || (nameRect && codeRect &&
                  Math.abs(nameRect.top - codeRect.top) <= 1 && Math.abs(nameRect.width - codeRect.width) <= 1);
                report("/hostels name and code fields align with equal widths", Boolean(name && code && desktopAligned));
                report("/hostels address spans the full clean form row", Boolean(addressField && addressRect &&
                  Math.abs(addressRect.width - gridWidth) <= 1 && addressField.classList.contains("full")),
                  addressRect ? `${Math.round(addressRect.width)}px / ${gridWidth}px` : "address field missing");
              }
            }
            if (routePath === "/students") {
              const studentForm = doc.querySelector(".student-create-form");
              if (studentForm) {
                const studentGrid = studentForm.querySelector(".student-create-form__fields");
                const alignedRows = [
                  ["studentNumber", "firstName", "lastName"],
                  ["email", "phone", "dateOfBirth"],
                  ["educationInstitution", "educationProgram", "educationYear"],
                ];
                const rowResults = alignedRows.map((names) => {
                  const fields = names.map((name) => studentGrid?.querySelector(`[name="${name}"]`)?.closest(".ui-field"));
                  const tops = fields.map((field) => field?.getBoundingClientRect().top);
                  return fields.every(Boolean) && (width <= 639 || Math.max(...tops) - Math.min(...tops) <= 1);
                });
                report("/students create form fields align in the requested desktop rows",
                  rowResults.every(Boolean), `${rowResults.filter(Boolean).length} / ${rowResults.length} rows`);
                const textInput = studentForm.querySelector('input[name="studentNumber"]');
                const statusSelect = studentForm.querySelector('select[name="status"]');
                const inputStyle = textInput ? doc.defaultView.getComputedStyle(textInput) : null;
                const selectStyle = statusSelect ? doc.defaultView.getComputedStyle(statusSelect) : null;
                report("/students status select matches text input height and weight",
                  Boolean(inputStyle && selectStyle && textInput.offsetHeight === 44 && statusSelect.offsetHeight === 44 &&
                    inputStyle.fontWeight === selectStyle.fontWeight),
                  `input=${inputStyle?.fontWeight ?? "missing"}/${textInput?.offsetHeight ?? "missing"}px; select=${selectStyle?.fontWeight ?? "missing"}/${statusSelect?.offsetHeight ?? "missing"}px`);
                const errorAlert = studentForm.querySelector('.student-create-form__message--error[role="alert"]');
                if (errorAlert) {
                  report("/students validation banner has a rounded inline alert surface",
                    Number.parseFloat(doc.defaultView.getComputedStyle(errorAlert).borderTopLeftRadius) >= 12);
                }
              }
            }
            if (routePath === "/room-availability") {
              const filters = doc.querySelector(".room-availability-filters");
              if (filters) {
                const building = filters.querySelector('select[name="building"]');
                const floor = filters.querySelector('select[name="floor"]');
                const checkbox = filters.querySelector('input[name="freeOnly"]');
                const apply = filters.querySelector('button[type="submit"]');
                const filterStyle = doc.defaultView.getComputedStyle(filters);
                const selectWidths = [building, floor].map((select) => select?.getBoundingClientRect().width ?? Number.POSITIVE_INFINITY);
                const selectWeights = [building, floor].map((select) => select ? doc.defaultView.getComputedStyle(select).fontWeight : "");
                report("/room-availability filters form one compact row on desktop and a column on mobile",
                  width <= 639 ? filterStyle.flexDirection === "column" : filterStyle.flexDirection === "row",
                  `direction=${filterStyle.flexDirection}`);
                report("/room-availability selects stay within 260px and share their font weight",
                  (width <= 639 || selectWidths.every((selectWidth) => selectWidth <= 260)) &&
                    selectWeights.length === 2 && selectWeights[0] === selectWeights[1],
                  `${selectWidths.map((selectWidth) => `${Math.round(selectWidth)}px`).join(" / ")}; weight=${selectWeights.join(" / ")}`);
                report("/room-availability checkbox and Apply filters button use the shared control sizes",
                  checkbox?.offsetWidth === 18 && checkbox.offsetHeight === 18 && apply?.offsetHeight === 44 &&
                    apply.classList.contains("ui-button--primary"));
              }
            }
            if (routePath === "/staff") {
              const table = doc.querySelector(".staff-directory-table");
              const tableWrap = doc.querySelector(".staff-directory-table-wrap");
              const staffRows = [...(table?.querySelectorAll("tbody tr") ?? [])];
              const wrapStyle = tableWrap ? doc.defaultView.getComputedStyle(tableWrap) : null;
              const headerStyle = table?.querySelector("thead th") ? doc.defaultView.getComputedStyle(table.querySelector("thead th")) : null;
              report("/staff table is inside a horizontal scroll region with a sticky header",
                Boolean(table && tableWrap && wrapStyle?.overflowX === "auto" && (width <= 639 || headerStyle?.position === "sticky")),
                `overflow-x=${wrapStyle?.overflowX ?? "missing"}; header=${headerStyle?.position ?? "missing"}`);
              const total = Number(doc.querySelector('.staff-kpis dt')?.nextElementSibling?.textContent ?? Number.NaN);
              const activeKpi = [...doc.querySelectorAll(".staff-kpis dt")].find((item) => item.textContent.trim() === "Active")?.nextElementSibling;
              report("/staff headcount KPIs match the rendered row count",
                Number.isFinite(total) && Number(activeKpi?.textContent) === total && total === staffRows.length,
                `${total} total / ${activeKpi?.textContent ?? "missing"} active / ${staffRows.length} visible rows`);
              const salaryCells = staffRows.map((row) => row.querySelector('[data-label="Monthly salary in PKR"]')?.textContent.trim() ?? "");
              const salaryValues = salaryCells.map((value) => /^PKR\s[\d,]+$/.test(value) ? Number(value.replace(/[^\d]/g, "")) : Number.NaN);
              report("/staff salary cells use PKR with Indian-style grouping", salaryCells.length > 0 && salaryValues.every(Number.isFinite),
                salaryCells.length ? salaryCells.slice(0, 3).join(" / ") : "no staff rows");
              const payrollKpi = [...doc.querySelectorAll(".staff-kpis dt")].find((item) => item.textContent.trim() === "Monthly payroll")?.nextElementSibling?.textContent.trim() ?? "";
              const salaryTotal = salaryValues.reduce((sum, value) => sum + value, 0);
              report("/staff payroll KPI equals the sum of staff row salaries",
                salaryValues.length > 0 && salaryValues.every(Number.isFinite) && payrollKpi === `PKR ${salaryTotal.toLocaleString("en-IN")}`,
                `KPI=${payrollKpi}; rows=${salaryCells.length} salary values`);
              const staffSearch = doc.querySelector('#staff-search');
              if (staffSearch && doc.querySelector('[data-demo-data="true"]')) {
                const setValue = Object.getOwnPropertyDescriptor(doc.defaultView.HTMLInputElement.prototype, "value")?.set;
                setValue?.call(staffSearch, "Imran");
                staffSearch.dispatchEvent(new doc.defaultView.Event("input", { bubbles: true }));
                await new Promise((resolve) => setTimeout(resolve, 80));
                const filteredRows = [...(table?.querySelectorAll("tbody tr") ?? [])];
                report("/staff searching Imran filters the demo rows", filteredRows.length === 1 && filteredRows[0].textContent.includes("Imran"),
                  `${filteredRows.length} matching row(s)`);
                setValue?.call(staffSearch, "");
                staffSearch.dispatchEvent(new doc.defaultView.Event("input", { bubbles: true }));
                await new Promise((resolve) => setTimeout(resolve, 80));
              }
              const addStaffButton = doc.querySelector(".page-heading__action button");
              const addStaffDialog = doc.querySelector(".staff-add-dialog");
              if (addStaffButton && addStaffDialog) {
                addStaffButton.click();
                await new Promise((resolve) => setTimeout(resolve, 80));
                report("/staff Add staff opens a labelled native modal dialog",
                  addStaffDialog.open && addStaffDialog.matches(":modal") && addStaffDialog.getAttribute("aria-modal") === "true" &&
                    addStaffDialog.querySelector("#staff-add-title")?.textContent.trim() === "Add staff");
                const staffForm = addStaffDialog.querySelector(".staff-add-form");
                const numberInput = staffForm?.querySelector('[name="employeeNumber"]');
                const valueSetter = numberInput ? Object.getOwnPropertyDescriptor(doc.defaultView.HTMLInputElement.prototype, "value")?.set : undefined;
                valueSetter?.call(numberInput, "");
                staffForm?.requestSubmit();
                await new Promise((resolve) => setTimeout(resolve, 80));
                const requiredErrorFields = ["userId", "employeeNumber", "jobTitle", "hostelIds"];
                const missingRequiredErrors = requiredErrorFields.filter((name) => staffForm?.querySelector(`[name="${name}"]`)?.getAttribute("aria-invalid") === "true");
                report("/staff empty Add staff submission shows inline errors for each unfilled required field",
                  missingRequiredErrors.length === requiredErrorFields.length,
                  `${missingRequiredErrors.length} / ${requiredErrorFields.length} required fields`);
                const existingNumber = table?.querySelector('tbody tr [data-label="Staff number"]')?.textContent.trim();
                if (existingNumber && numberInput) {
                  valueSetter?.call(numberInput, existingNumber);
                  numberInput.dispatchEvent(new doc.defaultView.Event("focusout", { bubbles: true }));
                  await new Promise((resolve) => setTimeout(resolve, 80));
                  report("/staff duplicate staff number is rejected with a clear inline error",
                    staffForm?.querySelector('[name="employeeNumber"]')?.getAttribute("aria-invalid") === "true" &&
                      staffForm.querySelector('[name="employeeNumber"]')?.parentElement?.textContent.includes("already in use"));
                }
                addStaffDialog.querySelector(".staff-add-dialog__close")?.click();
                await new Promise((resolve) => setTimeout(resolve, 80));
                report("/staff closing Add staff restores focus to its opener",
                  !addStaffDialog.open && doc.activeElement === addStaffButton);
              }
            }
            const themeToggle = doc.querySelector(".ui-theme-toggle");
            if (themeToggle) {
              themeToggle.click();
              report(`${route} at ${width}px theme toggle switches to dark`, doc.documentElement.dataset.theme === "dark");
              const reloaded = waitForFrame(frame);
              frame.contentWindow.location.reload();
              const reloadStatus = await reloaded;
              const reloadedTheme = frame.contentDocument?.documentElement.dataset.theme;
              report(`${route} at ${width}px reload returns to light despite saved dark preferences`,
                reloadStatus === "loaded" && reloadedTheme === "light", `reload=${reloadStatus}; theme=${reloadedTheme ?? "unavailable"}`);
            }
            frame.remove();
          }
        }
        const summary = document.createElement("p");
        summary.className = failures ? "fail" : "pass";
        summary.textContent = `${failures} failing check(s).`;
        document.body.append(summary);
      }

      run().catch((error) => report("test runner", false, error.message));
    