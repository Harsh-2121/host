// Initialize particles.js with enhanced interaction
        particlesJS("particles-js", {
            "particles": {
                "number": {
                    "value": 120,
                    "density": {
                        "enable": true,
                        "value_area": 800
                    }
                },
                "color": {
                    "value": "#00ff00"
                },
                "shape": {
                    "type": "circle",
                    "stroke": {
                        "width": 0,
                        "color": "#000000"
                    }
                },
                "opacity": {
                    "value": 0.5,
                    "random": false,
                    "anim": {
                        "enable": false,
                        "speed": 1,
                        "opacity_min": 0.1,
                        "sync": false
                    }
                },
                "size": {
                    "value": 3,
                    "random": true,
                    "anim": {
                        "enable": false,
                        "speed": 40,
                        "size_min": 0.1,
                        "sync": false
                    }
                },
                "line_linked": {
                    "enable": true,
                    "distance": 150,
                    "color": "#00ff00",
                    "opacity": 0.3,
                    "width": 1
                },
                "move": {
                    "enable": true,
                    "speed": 6,
                    "direction": "none",
                    "random": false,
                    "straight": false,
                    "out_mode": "out",
                    "bounce": false,
                    "attract": {
                        "enable": true,
                        "rotateX": 600,
                        "rotateY": 1200
                    }
                }
            },
            "interactivity": {
                "detect_on": "canvas",
                "events": {
                    "onhover": {
                        "enable": true,
                        "mode": "repulse",
                        "parallax": {
                            "enable": true,
                            "force": 60,
                            "smooth": 10
                        }
                    },
                    "onclick": {
                        "enable": true,
                        "mode": "push"
                    },
                    "resize": true
                },
                "modes": {
                    "grab": {
                        "distance": 400,
                        "line_linked": {
                            "opacity": 1
                        }
                    },
                    "bubble": {
                        "distance": 400,
                        "size": 40,
                        "duration": 2,
                        "opacity": 8,
                        "speed": 3
                    },
                    "repulse": {
                        "distance": 130,
                        "duration": 0.4
                    },
                    "push": {
                        "particles_nb": 4
                    },
                    "remove": {
                        "particles_nb": 2
                    }
                }
            },
            "retina_detect": true
        });
        
        // Matrix Rain Effect
        const matrixCanvas = document.getElementById('matrix-rain');
        const ctx = matrixCanvas.getContext('2d');
        
        matrixCanvas.width = window.innerWidth;
        matrixCanvas.height = window.innerHeight;
        
        const chars = "01";
        const charSize = 14;
        const columns = matrixCanvas.width / charSize;
        
        // Create drops for each column
        const drops = [];
        for (let i = 0; i < columns; i++) {
            drops[i] = Math.floor(Math.random() * matrixCanvas.height / charSize);
        }
        
        function drawMatrix() {
            // Fade effect
            ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
            ctx.fillRect(0, 0, matrixCanvas.width, matrixCanvas.height);
            
            ctx.fillStyle = '#00ff00';
            ctx.font = charSize + 'px monospace';
            
            for (let i = 0; i < drops.length; i++) {
                const text = chars.charAt(Math.floor(Math.random() * chars.length));
                ctx.fillText(text, i * charSize, drops[i] * charSize);
                
                if (drops[i] * charSize > matrixCanvas.height && Math.random() > 0.975) {
                    drops[i] = 0;
                }
                
                drops[i]++;
            }
        }
        
        setInterval(drawMatrix, 33);
        
        // Particle Controls
        const particleCount = document.getElementById('particle-count');
        const particleCountValue = document.getElementById('particle-count-value');
        const distance = document.getElementById('distance');
        const distanceValue = document.getElementById('distance-value');
        const speed = document.getElementById('speed');
        const speedValue = document.getElementById('speed-value');
        const force = document.getElementById('force');
        const forceValue = document.getElementById('force-value');
        const hoverRepel = document.getElementById('hover-repel');
        const clickAttract = document.getElementById('click-attract');
        const clickExplode = document.getElementById('click-explode');
        const currentMode = document.getElementById('current-mode');
        const particleIndicator = document.querySelector('.particle-indicator');
        
        // Update particle values
        function updateParticles() {
            const pJS = window.pJSDom[0].pJS;
            
            // Update particle count
            pJS.particles.number.value = parseInt(particleCount.value);
            pJS.fn.particlesRefresh();
            
            // Update connection distance
            pJS.particles.line_linked.distance = parseInt(distance.value);
            
            // Update particle speed
            pJS.particles.move.speed = parseInt(speed.value);
            
            // Update interaction force
            pJS.interactivity.modes.repulse.distance = parseInt(force.value);
            
            // Update values display
            particleCountValue.textContent = particleCount.value;
            distanceValue.textContent = distance.value;
            speedValue.textContent = speed.value;
            forceValue.textContent = force.value;
        }
        
        // Set up event listeners
        particleCount.addEventListener('input', updateParticles);
        distance.addEventListener('input', updateParticles);
        speed.addEventListener('input', updateParticles);
        force.addEventListener('input', updateParticles);
        
        // Set interaction mode
        function setMode(mode) {
            const pJS = window.pJSDom[0].pJS;
            
            // Reset all buttons
            hoverRepel.classList.remove('active');
            clickAttract.classList.remove('active');
            clickExplode.classList.remove('active');
            
            // Set the active button
            document.getElementById(mode).classList.add('active');
            
            // Update mode text
            currentMode.textContent = mode === 'hover-repel' ? 'Hover Repel' : 
                                     mode === 'click-attract' ? 'Click Attract' : 'Click Explode';
            
            // Set the interaction modes
            if (mode === 'hover-repel') {
                pJS.interactivity.events.onhover.mode = "repulse";
                pJS.interactivity.events.onclick.mode = "push";
            } 
            else if (mode === 'click-attract') {
                pJS.interactivity.events.onhover.mode = "grab";
                pJS.interactivity.events.onclick.mode = "bubble";
            } 
            else if (mode === 'click-explode') {
                pJS.interactivity.events.onhover.mode = "grab";
                pJS.interactivity.events.onclick.mode = "repulse";
            }
            
            pJS.fn.interactivityListeners();
        }
        
        // Set initial mode
        setMode('hover-repel');
        
        // Add event listeners to mode buttons
        hoverRepel.addEventListener('click', () => setMode('hover-repel'));
        clickAttract.addEventListener('click', () => setMode('click-attract'));
        clickExplode.addEventListener('click', () => setMode('click-explode'));
        
        // Enhanced mouse interaction visualization
        document.addEventListener('mousemove', (e) => {
            const pJS = window.pJSDom[0].pJS;
            const canvas = pJS.canvas.el;
            const rect = canvas.getBoundingClientRect();
            
            // Position particle indicator
            particleIndicator.style.display = 'block';
            particleIndicator.style.left = e.clientX + 'px';
            particleIndicator.style.top = e.clientY + 'px';
            
            // Create a repulsion effect based on mode
            if (hoverRepel.classList.contains('active')) {
                const mousePos = {
                    x: (e.clientX - rect.left) / rect.width * canvas.width,
                    y: (e.clientY - rect.top) / rect.height * canvas.height
                };
                
                // Create repulsion area
                pJS.interactivity.mouse.pos_x = mousePos.x;
                pJS.interactivity.mouse.pos_y = mousePos.y;
                
                // Trigger repulse
                pJS.fn.modeRepulse();
            }
        });
        
        document.addEventListener('mouseleave', () => {
            particleIndicator.style.display = 'none';
        });
        
        // Click interaction visualization
        document.addEventListener('click', (e) => {
            const indicator = particleIndicator;
            
            // Visual effect on click
            indicator.style.transform = 'translate(-50%, -50%) scale(2)';
            indicator.style.opacity = '0.7';
            
            setTimeout(() => {
                indicator.style.transform = 'translate(-50%, -50%) scale(1)';
                indicator.style.opacity = '0.3';
            }, 300);
        });
        
        // Reset particles button
        const resetBtn = document.createElement('div');
        resetBtn.className = 'toggle-btn';
        resetBtn.textContent = 'Reset';
        resetBtn.style.marginTop = '10px';
        resetBtn.addEventListener('click', () => {
            particleCount.value = 120;
            distance.value = 150;
            speed.value = 6;
            force.value = 130;
            setMode('hover-repel');
            updateParticles();
        });
        document.querySelector('.particle-controls').appendChild(resetBtn);
        
        // Responsive canvas
        window.addEventListener('resize', () => {
            matrixCanvas.width = window.innerWidth;
            matrixCanvas.height = window.innerHeight;
            
            // Reinitialize particles.js
            particlesJS("particles-js", window.pJSDom[0].pJS);
        });
        
        // Audio feedback for interactions
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        
        function playSound(frequency, duration) {
            const oscillator = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            
            oscillator.type = 'sine';
            oscillator.frequency.value = frequency;
            gainNode.gain.value = 0.1;
            
            oscillator.start();
            gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
            oscillator.stop(audioCtx.currentTime + duration);
        }
        
        // Add sound to slider interactions
        const sliders = document.querySelectorAll('.slider');
        sliders.forEach(slider => {
            slider.addEventListener('input', () => {
                playSound(300 + (slider.value * 2), 0.1);
            });
        });
        
        // Add sound to mode changes
        const modeButtons = document.querySelectorAll('.toggle-btn');
        modeButtons.forEach(button => {
            button.addEventListener('click', () => {
                playSound(500, 0.2);
            });    
        // Matrix Rain Effect
        const matrixCanvas = document.getElementById('matrix-rain');
        const ctx = matrixCanvas.getContext('2d');
        
        matrixCanvas.width = window.innerWidth;
        matrixCanvas.height = window.innerHeight;
        
        const chars = "01";
        const charSize = 14;
        const columns = matrixCanvas.width / charSize;
        
        // Create drops for each column
        const drops = [];
        for (let i = 0; i < columns; i++) {
            drops[i] = Math.floor(Math.random() * matrixCanvas.height / charSize);
        }
        
        function drawMatrix() {
            // Fade effect
            ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
            ctx.fillRect(0, 0, matrixCanvas.width, matrixCanvas.height);
            
            ctx.fillStyle = '#00ff00';
            ctx.font = charSize + 'px monospace';
            
            for (let i = 0; i < drops.length; i++) {
                const text = chars.charAt(Math.floor(Math.random() * chars.length));
                ctx.fillText(text, i * charSize, drops[i] * charSize);
                
                if (drops[i] * charSize > matrixCanvas.height && Math.random() > 0.975) {
                    drops[i] = 0;
                }
                
                drops[i]++;
            }
        }
        
        setInterval(drawMatrix, 33);
        
        // Terminal Game
        const terminalGame = document.getElementById('terminal-game');
        const terminalOutput = document.getElementById('terminal-output');
        const terminalCmd = document.getElementById('terminal-cmd');
        const terminalGameBtn = document.getElementById('terminal-game-btn');
        const closeTerminal = document.getElementById('close-terminal');
        
        const commands = {
            help: "Available commands: help, about, date, clear, echo [text], hack, secret",
            about: "Terminal Adventure v1.0 - A cyber text adventure",
            date: () => new Date().toLocaleString(),
            clear: () => { terminalOutput.innerHTML = "> "; return ""; },
            echo: (args) => args.join(" "),
            hack: () => {
                terminalOutput.innerHTML += "\n> INITIATING HACK SEQUENCE...";
                setTimeout(() => terminalOutput.innerHTML += "\n> BYPASSING SECURITY...", 800);
                setTimeout(() => terminalOutput.innerHTML += "\n> ACCESSING MAINFRAME...", 1600);
                setTimeout(() => terminalOutput.innerHTML += "\n> SYSTEM COMPROMISED!", 2400);
                return "\n> HACK COMPLETE!";
            },
            secret: "> CONGRATULATIONS! YOU FOUND THE SECRET COMMAND!",
        };
        
        terminalCmd.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const cmd = terminalCmd.value.trim().toLowerCase();
                const args = cmd.split(' ');
                const baseCmd = args.shift();
                
                terminalOutput.innerHTML += `\n> ${cmd}`;
                
                if (commands[baseCmd]) {
                    const result = typeof commands[baseCmd] === 'function' 
                        ? commands[baseCmd](args) 
                        : commands[baseCmd];
                    
                    if (result) terminalOutput.innerHTML += `\n${result}`;
                } else {
                    terminalOutput.innerHTML += `\n> Command not found: ${baseCmd}`;
                }
                
                terminalOutput.innerHTML += "\n> ";
                terminalCmd.value = "";
                terminalOutput.scrollTop = terminalOutput.scrollHeight;
            }
        });
        
        // Cyber Defender Game
        const cyberGame = document.getElementById('cyber-defender');
        const cyberCanvas = document.getElementById('game-canvas');
        const cyberCtx = cyberCanvas.getContext('2d');
        const cyberGameBtn = document.getElementById('cyber-defender-btn');
        const closeCyber = document.getElementById('close-cyber');
        
        let gameRunning = false;
        let player = {
            x: cyberCanvas.width / 2 - 25,
            y: cyberCanvas.height - 40,
            width: 50,
            height: 20,
            speed: 8
        };
        
        let bullets = [];
        let enemies = [];
        let score = 0;
        
        function initCyberGame() {
            player.x = cyberCanvas.width / 2 - 25;
            bullets = [];
            enemies = [];
            score = 0;
            gameRunning = true;
            
            // Create initial enemies
            for (let i = 0; i < 5; i++) {
                enemies.push({
                    x: Math.random() * (cyberCanvas.width - 30),
                    y: Math.random() * 100,
                    width: 30,
                    height: 30,
                    speed: 1 + Math.random() * 2
                });
            }
            
            drawCyberGame();
        }
        
        function drawPlayer() {
            cyberCtx.fillStyle = '#00ccff';
            cyberCtx.fillRect(player.x, player.y, player.width, player.height);
            
            // Draw player details
            cyberCtx.fillStyle = '#00ff00';
            cyberCtx.fillRect(player.x + 10, player.y - 10, 5, 10);
            cyberCtx.fillRect(player.x + 35, player.y - 10, 5, 10);
        }
        
        function drawBullets() {
            cyberCtx.fillStyle = '#00ff00';
            bullets.forEach(bullet => {
                cyberCtx.beginPath();
                cyberCtx.arc(bullet.x, bullet.y, 3, 0, Math.PI * 2);
                cyberCtx.fill();
            });
        }
        
        function drawEnemies() {
            cyberCtx.fillStyle = '#ff0055';
            enemies.forEach(enemy => {
                cyberCtx.fillRect(enemy.x, enemy.y, enemy.width, enemy.height);
                
                // Draw enemy details
                cyberCtx.fillStyle = '#ff0000';
                cyberCtx.fillRect(enemy.x + 5, enemy.y + 5, 8, 8);
                cyberCtx.fillRect(enemy.x + 17, enemy.y + 5, 8, 8);
                cyberCtx.fillStyle = '#ff0055';
            });
        }
        
        function drawCyberGame() {
            if (!gameRunning) return;
            
            cyberCtx.clearRect(0, 0, cyberCanvas.width, cyberCanvas.height);
            
            // Draw grid background
            cyberCtx.strokeStyle = 'rgba(0, 255, 0, 0.1)';
            cyberCtx.lineWidth = 0.5;
            
            for (let x = 0; x < cyberCanvas.width; x += 20) {
                cyberCtx.beginPath();
                cyberCtx.moveTo(x, 0);
                cyberCtx.lineTo(x, cyberCanvas.height);
                cyberCtx.stroke();
            }
            
            for (let y = 0; y < cyberCanvas.height; y += 20) {
                cyberCtx.beginPath();
                cyberCtx.moveTo(0, y);
                cyberCtx.lineTo(cyberCanvas.width, y);
                cyberCtx.stroke();
            }
            
            drawPlayer();
            drawBullets();
            drawEnemies();
            
            // Draw score
            cyberCtx.fillStyle = '#00ff00';
            cyberCtx.font = '16px "Share Tech Mono"';
            cyberCtx.fillText(`SCORE: ${score}`, 10, 20);
            
            updateGame();
            requestAnimationFrame(drawCyberGame);
        }
        
        function updateGame() {
            // Move bullets
            bullets.forEach((bullet, idx) => {
                bullet.y -= 7;
                
                // Remove bullets that go off screen
                if (bullet.y < 0) {
                    bullets.splice(idx, 1);
                }
                
                // Check for collisions
                enemies.forEach((enemy, eIdx) => {
                    if (bullet.x > enemy.x && bullet.x < enemy.x + enemy.width &&
                        bullet.y > enemy.y && bullet.y < enemy.y + enemy.height) {
                        bullets.splice(idx, 1);
                        enemies.splice(eIdx, 1);
                        score += 10;
                        
                        // Add new enemy
                        enemies.push({
                            x: Math.random() * (cyberCanvas.width - 30),
                            y: Math.random() * 100,
                            width: 30,
                            height: 30,
                            speed: 1 + Math.random() * 2
                        });
                    }
                });
            });
            
            // Move enemies
            enemies.forEach(enemy => {
                enemy.y += enemy.speed / 2;
                
                // Reset enemy if it goes off screen
                if (enemy.y > cyberCanvas.height) {
                    enemy.y = -30;
                    enemy.x = Math.random() * (cyberCanvas.width - 30);
                }
                
                // Check for collision with player
                if (player.x < enemy.x + enemy.width &&
                    player.x + player.width > enemy.x &&
                    player.y < enemy.y + enemy.height &&
                    player.y + player.height > enemy.y) {
                    gameRunning = false;
                    cyberCtx.fillStyle = 'rgba(255, 0, 0, 0.5)';
                    cyberCtx.fillRect(0, 0, cyberCanvas.width, cyberCanvas.height);
                    cyberCtx.fillStyle = '#ffffff';
                    cyberCtx.font = '24px "Share Tech Mono"';
                    cyberCtx.fillText('SYSTEM BREACHED!', cyberCanvas.width/2 - 120, cyberCanvas.height/2);
                    cyberCtx.font = '18px "Share Tech Mono"';
                    cyberCtx.fillText(`FINAL SCORE: ${score}`, cyberCanvas.width/2 - 80, cyberCanvas.height/2 + 40);
                }
            });
        }
        
        // Player controls
        document.addEventListener('keydown', (e) => {
            if (!gameRunning) return;
            
            switch (e.key) {
                case 'ArrowLeft':
                    player.x = Math.max(0, player.x - player.speed);
                    break;
                case 'ArrowRight':
                    player.x = Math.min(cyberCanvas.width - player.width, player.x + player.speed);
                    break;
                case ' ':
                    bullets.push({
                        x: player.x + player.width / 2,
                        y: player.y
                    });
                    break;
            }
        });
        
        // Memory Game
        const memoryGame = document.getElementById('memory-game');
        const memoryGrid = document.getElementById('memory-grid');
        const memoryGameBtn = document.getElementById('memory-game-btn');
        const closeMemory = document.getElementById('close-memory');
        const memoryScore = document.getElementById('memory-score');
        
        const symbols = ['💻', '🔒', '🔑', '🌐', '💾', '📡', '🖥️', '⌨️'];
        let cards = [];
        let flippedCards = [];
        let matchedPairs = 0;
        let attempts = 0;
        
        function initMemoryGame() {
            // Create pairs
            let gameSymbols = [...symbols, ...symbols];
            gameSymbols.sort(() => Math.random() - 0.5);
            
            cards = [];
            flippedCards = [];
            matchedPairs = 0;
            attempts = 0;
            memoryScore.textContent = "Matches: 0 | Attempts: 0";
            
            memoryGrid.innerHTML = '';
            
            gameSymbols.forEach((symbol, index) => {
                const card = document.createElement('div');
                card.className = 'memory-card';
                card.dataset.symbol = symbol;
                card.dataset.index = index;
                card.textContent = symbol;
                card.addEventListener('click', flipCard);
                memoryGrid.appendChild(card);
                cards.push(card);
            });
        }
        
        function flipCard() {
            if (flippedCards.length === 2 || this.classList.contains('flipped') || this.classList.contains('matched')) 
                return;
            
            this.classList.add('flipped');
            flippedCards.push(this);
            
            if (flippedCards.length === 2) {
                attempts++;
                memoryScore.textContent = `Matches: ${matchedPairs} | Attempts: ${attempts}`;
                
                const card1 = flippedCards[0];
                const card2 = flippedCards[1];
                
                if (card1.dataset.symbol === card2.dataset.symbol) {
                    setTimeout(() => {
                        card1.classList.add('matched');
                        card2.classList.add('matched');
                        flippedCards = [];
                        matchedPairs++;
                        memoryScore.textContent = `Matches: ${matchedPairs} | Attempts: ${attempts}`;
                        
                        if (matchedPairs === symbols.length) {
                            setTimeout(() => {
                                memoryScore.textContent = `YOU WIN! Matches: ${matchedPairs} | Attempts: ${attempts}`;
                            }, 500);
                        }
                    }, 500);
                } else {
                    setTimeout(() => {
                        card1.classList.remove('flipped');
                        card2.classList.remove('flipped');
                        flippedCards = [];
                    }, 1000);
                }
            }
        }
        
        // Cipher Game
        const cipherGame = document.getElementById('cipher-game');
        const cipherDisplay = document.getElementById('cipher-display');
        const cipherInput = document.getElementById('cipher-input');
        const cipherSubmit = document.getElementById('cipher-submit');
        const cipherResult = document.getElementById('cipher-result');
        const cipherScore = document.getElementById('cipher-score');
        const cipherGameBtn = document.getElementById('cipher-game-btn');
        const closeCipher = document.getElementById('close-cipher');
        
        const cipherMessages = [
            "SECURE COMMUNICATION CHANNEL",
            "ACCESS GRANTED TO MAINFRAME",
            "SYSTEM UPDATE IN PROGRESS",
            "CYBER SECURITY PROTOCOL ACTIVATED",
            "NETWORK CONNECTION ESTABLISHED",
            "DATA ENCRYPTION COMPLETE"
        ];
        
        let cipherLevel = 1;
        let cipherPoints = 0;
        let currentCipher = "";
        
        function generateCipher() {
            const message = cipherMessages[Math.floor(Math.random() * cipherMessages.length)];
            let encoded = "";
            
            // Simple substitution cipher
            for (let i = 0; i < message.length; i++) {
                if (message[i] === ' ') {
                    encoded += ' ';
                } else {
                    // Shift character by level (with wrap-around)
                    let charCode = message.charCodeAt(i);
                    let shifted = charCode + cipherLevel;
                    if (shifted > 90) shifted -= 26; // Wrap around if beyond 'Z'
                    encoded += String.fromCharCode(shifted);
                }
            }
            
            currentCipher = message;
            cipherDisplay.textContent = encoded;
            cipherInput.value = "";
            cipherResult.textContent = "";
        }
        
        function checkCipher() {
            const guess = cipherInput.value.trim().toUpperCase();
            
            if (guess === currentCipher) {
                cipherResult.textContent = "DECRYPTION SUCCESSFUL!";
                cipherResult.style.color = "#00ff00";
                cipherPoints += cipherLevel * 10;
                cipherLevel++;
            } else {
                cipherResult.textContent = "DECRYPTION FAILED! TRY AGAIN.";
                cipherResult.style.color = "#ff5555";
            }
            
            cipherScore.textContent = `Score: ${cipherPoints} | Level: ${cipherLevel}`;
            setTimeout(generateCipher, 2000);
        }
        
        // Game Window Controls
        function showGame(game) {
            document.querySelectorAll('.game-window').forEach(win => win.style.display = 'none');
            game.style.display = 'flex';
            
            // Initialize game if needed
            if (game.id === 'cyber-defender') initCyberGame();
            if (game.id === 'memory-game') initMemoryGame();
            if (game.id === 'cipher-game') {
                cipherLevel = 1;
                cipherPoints = 0;
                cipherScore.textContent = `Score: 0 | Level: 1`;
                generateCipher();
            }
        }
        
        terminalGameBtn.addEventListener('click', () => showGame(terminalGame));
        cyberGameBtn.addEventListener('click', () => showGame(cyberGame));
        memoryGameBtn.addEventListener('click', () => showGame(memoryGame));
        cipherGameBtn.addEventListener('click', () => showGame(cipherGame));
        
        closeTerminal.addEventListener('click', () => terminalGame.style.display = 'none');
        closeCyber.addEventListener('click', () => {
            cyberGame.style.display = 'none';
            gameRunning = false;
        });
        closeMemory.addEventListener('click', () => memoryGame.style.display = 'none');
        closeCipher.addEventListener('click', () => cipherGame.style.display = 'none');
        
        // Audio Player
        const playBtn = document.getElementById('play-btn');
        const pauseBtn = document.getElementById('pause-btn');
        const muteBtn = document.getElementById('mute-btn');
        
        // Create audio element
        const audio = new Audio();
        audio.loop = true;
        
        // Audio source - using data URI for embedded audio
        audio.src = "data:audio/mpeg;base64,SUQzBAAAAAABEVRYWFgAAAAtAAADY29tbWVudABCaWdTb3VuZEJhbmsuY29tIC8gTGFTb25vdGhlcXVlLm9yZwBURU5DAAAAHQAAA1N3aXRjaCBQbHVzIMKpIE5DSCBTb2Z0d2FyZQBUSVQyAAAABgAAAzIyMzUAVFNTRQAAAA8AAANMYXZmNTcuODMuMTAwAAAAAAAAAAAAAAD/80DEAAAAA0gAAAAATEFNRTMuMTAwVVVVVVVVVVVVVUxBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/zQsRbAAADSAAAAABVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/zQMSkAAADSAAAAABVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV";
        
        playBtn.addEventListener('click', () => audio.play());
        pauseBtn.addEventListener('click', () => audio.pause());
        muteBtn.addEventListener('click', () => {
            audio.muted = !audio.muted;
            muteBtn.textContent = audio.muted ? "🔇" : "🔊";
        });
        
        // Responsive canvas
        window.addEventListener('resize', () => {
            matrixCanvas.width = window.innerWidth;
            matrixCanvas.height = window.innerHeight;
        });