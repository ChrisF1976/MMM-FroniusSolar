Module.register("MMM-FroniusSolar", {
    defaults: {
        updateInterval: 60000, // Update every 60 seconds
        icons: {
            P_Akku: "mdi:car-battery",
            P_Grid: "mdi:transmission-tower",
            P_Load: "mdi:home-lightbulb",
            P_PV: "mdi:solar-panel-large",
        },
        Radius: 80, // Radius for the SVG gauge
        MaxPower: 1000, // Maximum power for the outer circle
        MaxPowerPV: 10400, // Maximum power for the middle circle
	ShowText: true,
        TextMessge: [
            { about: "600", Text: "Leicht erhöhter Netzbezug.", color: "#999" },
            { about: "1000", Text: "Über 1 KW Netzbezug!", color: "#ffffff" },
            { about: "1500", Text: "Über 1,5KW Netzbezug.", color: "#eea205" },
            { about: "2500", Text: "Über 2,5KW aus dem Netz!", color: "#ec7c25" },
            { about: "5000", Text: "Auto lädt, richtig? Nächstes Mal auf Sonne warten.", color: "#cc0605" },
            { less: "-500", Text: "Sonne scheint! Mehr als 500W frei.", color: "#f8f32b" },
            { less: "-2000", Text: "Wäsche waschen! Über 2KW freie Energie!", color: "#00bb2d" },
            { less: "-4000", Text: "Auto laden! Über 4KW freie Energie!", color: "#f80000" },
        ],
    },

    start: function () {
        this.solarData = null;
        this.solarSOC = null; // Added for SOC
        this.sendSocketNotification("GET_FRONIUS_DATA");
        this.scheduleUpdate();
    },

    getStyles: function () {
        return ["MMM-FroniusSolar.css", "https://code.iconify.design/2/2.2.1/iconify.min.js"];
    },

    scheduleUpdate: function () {
        const self = this;
        setInterval(function () {
            self.sendSocketNotification("GET_FRONIUS_DATA");
        }, this.config.updateInterval);
    },

    socketNotificationReceived: function (notification, payload) {
        if (notification === "FRONIUS_DATA") {
            this.solarData = {
                P_Akku: Math.round(payload.P_Akku),
                P_Grid: Math.round(payload.P_Grid),
                P_Load: Math.round(payload.P_Load),
                P_PV: Math.round(payload.P_PV)
            };
            this.solarSOC = payload.Inverters && payload.Inverters["1"] && payload.Inverters["1"].SOC ? payload.Inverters["1"].SOC : 0; // Safely get SOC
            this.updateDom();
        }
    },

    getDom: function () {
        const wrapper = document.createElement("div");
        wrapper.className = "solar-wrapper";

        if (!this.solarData) {
            wrapper.innerHTML = "Loading...";
            return wrapper;
        }

        const radius = this.config.Radius;
        const maxPower = this.config.MaxPower;
        const maxPowerPV = this.config.MaxPowerPV;

        // Create SVG with outer, middle, and inner circles combined
        const outerPower = this.solarData.P_Grid + this.solarData.P_Akku + this.solarData.P_PV;
        const middlePower = this.solarData.P_PV;
        const socValue = this.solarSOC; // SOC Value

	let outerColor;
	if ((this.solarData.P_Akku-100) > Math.abs(this.solarData.P_Grid)) {
	    outerColor = "#a3c49f"; // Light green for high battery activity
	} else if (this.solarData.P_Grid > 150) {
	    outerColor = "#808080"; // Gray for grid consumption over 150W
	} else if (outerPower >= 0) {
	    outerColor = "#00ff00"; // Green	
	} else {
	    outerColor = "#0000ff"; // Blue
	}

        const middleColor = "#1e90ff";
        const innerColor = "#ffcc00"; // Yellow for SOC

        const svgGauge = document.createElement("div");
        svgGauge.className = "svg-gauge";

        svgGauge.innerHTML = `
            <svg width="${radius * 2}" height="${radius * 2}" viewBox="0 0 ${(radius * 2)} ${radius * 2}">
                <defs>
                    <filter id="glow">
                        <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
                        <feMerge>
                            <feMergeNode in="coloredBlur"/>
                            <feMergeNode in="SourceGraphic"/>
                        </feMerge>
                    </filter>
                </defs>

                <!-- Outer Circle Background -->
                <circle cx="${radius}" cy="${radius}" r="${radius * 0.9}" stroke="#e0e0e0" stroke-width="12" fill="none" opacity="0.75"/>

                <!-- Outer Circle Progress -->
                <circle cx="${radius}" cy="${radius}" r="${radius * 0.9}" stroke="${outerColor}" stroke-width="12" fill="none"
                    stroke-dasharray="${(Math.min(Math.abs(outerPower), maxPower) / maxPower) * 2 * Math.PI * (radius * 0.9)} ${(2 * Math.PI * (radius * 0.9))}" 
                    transform="rotate(-90 ${radius} ${radius})" filter="url(#glow)"/>

                <!-- Middle Circle Background -->
                <circle cx="${radius}" cy="${radius}" r="${radius * 0.76}" stroke="#e0e0e0" stroke-width="8" fill="none" opacity="0.75"/>

                <!-- Middle Circle Progress -->
                <circle cx="${radius}" cy="${radius}" r="${radius * 0.76}" stroke="${middleColor}" stroke-width="8" fill="none"
                    stroke-dasharray="${(Math.min(Math.abs(middlePower), maxPowerPV) / maxPowerPV) * 2 * Math.PI * (radius * 0.76)} ${(2 * Math.PI * (radius * 0.76))}" 
                    transform="rotate(-90 ${radius} ${radius})" filter="url(#glow)"/>

                <!-- Inner Circle Background -->
                <circle cx="${radius}" cy="${radius}" r="${radius * 0.65}" stroke="#e0e0e0" stroke-width="6" fill="none" opacity="0.75"/>

                <!-- Inner Circle Progress -->
                <circle cx="${radius}" cy="${radius}" r="${radius * 0.65}" stroke="${innerColor}" stroke-width="6" fill="none"
                    stroke-dasharray="${(socValue / 100) * 2 * Math.PI * (radius * 0.65)} ${(2 * Math.PI * (radius * 0.65))}" 
                    transform="rotate(-90 ${radius} ${radius})" filter="url(#glow)"/>

		<!-- Outer Circle Text -->
		<foreignObject x="${radius * 0.5}" y="${radius * 0.6}" width="${radius}" height="${radius * 0.3}">
		    <div xmlns="http://www.w3.org/1999/xhtml" style="display: flex; justify-content: center; align-items: center;">
		        <span class="iconify" 
		              data-icon="${outerPower < 0 ? this.config.icons.P_Grid : this.config.icons.P_Load}" 
		              data-inline="false" 
		              style="color: ${outerPower < 0 ? 'red' : '#ffffff'};"></span>
		        <span style="color: #ffffff; font-size: 20px;"> &nbsp;${Math.round(outerPower)} W</span>
		    </div>
		</foreignObject>

                <!-- Middle Circle Text -->
                <foreignObject x="${radius * 0.5}" y="${radius * 0.9}" width="${radius}" height="${radius * 0.3}">
                    <div xmlns="http://www.w3.org/1999/xhtml" style="display: flex; justify-content: center; align-items: center;">
                        <span class="iconify" data-icon="${this.config.icons.P_PV}" data-inline="false"></span>
                        <span style="color: #ffffff; font-size: 20px;"> &nbsp;${Math.round(middlePower)} W</span>
                    </div>
                </foreignObject>

                <!-- Inner Circle Text -->
                <foreignObject x="${radius * 0.5}" y="${radius*1.2}" width="${radius}" height="${radius * 0.3}">
                    <div xmlns="http://www.w3.org/1999/xhtml" style="display: flex; justify-content: center; align-items: center;">
                        <span class="iconify" data-icon="mdi:battery" data-inline="false"> </span>
                        <span style="color: #ffffff; font-size: 20px;"> &nbsp;${socValue} % </span>
                    </div>
                </foreignObject>
            </svg>
        `;

        wrapper.appendChild(svgGauge);

    // Add dynamic text message below the gauge
    if (this.config.ShowText) {
        const textMessageDiv = document.createElement("div");
        textMessageDiv.className = "text-message";

        const messageConfig = this.config.TextMessge || [];
        let selectedMessage = null;

	for (const message of messageConfig) {
	    if (
	        (message.about && this.solarData.P_Grid > parseInt(message.about)) ||
	        (message.less && this.solarData.P_Grid < parseInt(message.less))
	    ) {
	        // If no message is selected yet, or the new match is more specific
	        if (
	            !selectedMessage ||
	            (message.about && parseInt(message.about) > parseInt(selectedMessage.about || -Infinity)) ||
	            (message.less && parseInt(message.less) < parseInt(selectedMessage.less || Infinity))
	        ) {
	            selectedMessage = message;
	        }
	    }
	}

        if (selectedMessage) {
            textMessageDiv.innerHTML = `
                <span style="color: ${selectedMessage.color}; font-size: 18px;">
                    ${selectedMessage.Text}
                </span>
            `;
        } else {
            textMessageDiv.innerHTML = `
                <span style="color: #999; font-size: 16px;">
                    PV Anlage läuft...
                </span>
            `;
        }

        wrapper.appendChild(textMessageDiv);
    	}

/*
        // Add Iconify-based display below the gauges
        const iconWrapper = document.createElement("div");
        iconWrapper.className = "solar-icons";

        const icons = [
            { key: "P_Grid", value: `${this.solarData.P_Grid} W`, icon: this.config.icons.P_Grid },
            { key: "P_Akku", value: `${this.solarData.P_Akku} W`, icon: this.config.icons.P_Akku },
            { key: "P_Load", value: `${this.solarData.P_Load} W`, icon: this.config.icons.P_Load },
            { key: "P_PV", value: `${this.solarData.P_PV} W`, icon: this.config.icons.P_PV },
            { key: "SOC", value: `${socValue} %`, icon: "mdi:battery" }
        ];

        icons.forEach(item => {
            const rowDiv = document.createElement("div");
            rowDiv.className = "solar-row";

            const icon = document.createElement("span");
            icon.className = "iconify";
            icon.setAttribute("data-icon", item.icon);
            icon.setAttribute("data-inline", "false");

            const value = document.createElement("span");
            value.className = "solar-value";
            value.innerHTML = item.value;

            rowDiv.appendChild(icon);
            rowDiv.appendChild(value);
            iconWrapper.appendChild(rowDiv);
        });

        wrapper.appendChild(iconWrapper);
*/
        return wrapper;
    }
});
