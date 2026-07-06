// Montreal Tênis Clube - Preferences Form JavaScript

// 1. Supabase Initialization
const SUPABASE_URL = "https://ehhjnwosqcrfwonqhfoz.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVoaGpud29zcWNyZndvbnFoZm96Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4OTc4NjksImV4cCI6MjA3ODQ3Mzg2OX0.qxbGgdq3lOiOmXuY8fMok7xlNluKPQIKoC3zQroUYSQ";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 2. Global State & Constants
let clientsList = [];
let selectedClient = null; // { customer_code, name }

const DAYS_OF_WEEK = [
    { id: 1, name: "Segunda-feira" },
    { id: 2, name: "Terça-feira" },
    { id: 3, name: "Quarta-feira" },
    { id: 4, name: "Quinta-feira" },
    { id: 5, name: "Sexta-feira" },
    { id: 6, name: "Sábado" },
    { id: 7, name: "Domingo" }
];

// Hour slots definitions based on shifts
const SLOTS_WEEKDAY = {
    "Manhã": ["07:00 - 08:00", "08:00 - 09:00", "09:00 - 10:00", "10:00 - 11:00", "11:00 - 12:00"],
    "Tarde": ["12:00 - 13:00", "13:00 - 14:00", "14:00 - 15:00", "15:00 - 16:00", "16:00 - 17:00", "17:00 - 18:00"],
    "Noite": ["18:00 - 19:00", "19:00 - 20:00", "20:00 - 21:00"]
};

const SLOTS_WEEKEND = {
    "Manhã": ["07:00 - 08:00", "08:00 - 09:00", "09:00 - 10:00", "10:00 - 11:00", "11:00 - 12:00"],
    "Tarde": ["12:00 - 13:00", "13:00 - 14:00", "14:00 - 15:00", "15:00 - 16:00", "16:00 - 17:00"]
};

// DOM Elements
const stepIdentification = document.getElementById('step-identification');
const stepPreferences = document.getElementById('step-preferences');
const stepSuccess = document.getElementById('step-success');

const clientSearchInput = document.getElementById('client-search');
const autocompleteList = document.getElementById('autocomplete-list');
const phoneVerificationGroup = document.getElementById('phone-verification-group');
const phoneDigitsInput = document.getElementById('phone-digits');
const btnNextStep = document.getElementById('btn-next-step');
const authErrorMsg = document.getElementById('auth-error-msg');

const userDisplayName = document.getElementById('user-display-name');
const btnChangeUser = document.getElementById('btn-change-user');
const preferencesForm = document.getElementById('preferences-form');
const frequencyRange = document.getElementById('frequency-range');
const frequencyDisplay = document.getElementById('frequency-display');
const accordionDaysContainer = document.getElementById('accordion-days-container');

const btnRestart = document.getElementById('btn-restart');

// 3. Page Initialization
document.addEventListener('DOMContentLoaded', async () => {
    // Render the accordion dynamically
    renderAccordion();

    // Range slider value update listener
    frequencyRange.addEventListener('input', (e) => {
        frequencyDisplay.textContent = e.target.value;
    });

    // Check for custom parameters in URL (e.g. ?code=000107)
    const urlParams = new URLSearchParams(window.location.search);
    const codeParam = urlParams.get('code');

    // Load clients
    try {
        await loadClients();
        
        if (codeParam) {
            const cleanCode = codeParam.padStart(6, '0');
            const matched = clientsList.find(c => c.customer_code === cleanCode);
            if (matched) {
                // Check if already authenticated via localStorage
                const savedAuthCode = localStorage.getItem('authenticated_customer_code');
                if (savedAuthCode === cleanCode) {
                    selectedClient = matched;
                    clientSearchInput.value = matched.name;
                    clientSearchInput.disabled = true;
                    clientSearchInput.style.backgroundColor = '#f1f3f5';
                    clientSearchInput.style.cursor = 'not-allowed';
                    
                    userDisplayName.textContent = matched.name;
                    await loadExistingPreferences(cleanCode);
                    transitionStep(stepIdentification, stepPreferences);
                    return;
                }
                
                selectClientItem(matched);
                // Lock the input
                clientSearchInput.disabled = true;
                clientSearchInput.style.backgroundColor = '#f1f3f5';
                clientSearchInput.style.cursor = 'not-allowed';
            }
        }
    } catch (err) {
        console.error("Error loading clients list:", err);
        showAuthError("Não foi possível carregar a lista de clientes. Por favor, recarregue a página.");
    }
});

// Load client list from Supabase using secure RPC
async function loadClients() {
    const { data, error } = await supabaseClient.rpc('fn_mt_listar_clientes');
        
    if (error) throw error;
    clientsList = data || [];
    
    // Setup autocomplete input listeners
    setupAutocompleteInput();
}

// 4. Dynamic Accordion Generation
function renderAccordion() {
    accordionDaysContainer.innerHTML = '';
    
    DAYS_OF_WEEK.forEach(day => {
        const isWeekend = day.id === 6 || day.id === 7;
        const shifts = isWeekend ? SLOTS_WEEKEND : SLOTS_WEEKDAY;
        
        // Create accordion item
        const item = document.createElement('div');
        item.className = 'accordion-item';
        item.id = `accordion-day-${day.id}`;
        
        // Header
        const header = document.createElement('button');
        header.type = 'button';
        header.className = 'accordion-header';
        header.innerHTML = `
            <div class="day-title-wrapper">
                <span class="day-name">${day.name}</span>
                <span class="day-badge" id="badge-day-${day.id}">Inativo</span>
            </div>
            <span class="accordion-arrow">▼</span>
        `;
        
        // Accordion click listener to expand/collapse
        header.addEventListener('click', () => {
            const isExpanded = item.classList.contains('expanded');
            
            // Collapse all other expanded items first (optional, for neat accordion effect)
            document.querySelectorAll('.accordion-item').forEach(el => {
                if (el !== item) el.classList.remove('expanded');
            });
            
            item.classList.toggle('expanded', !isExpanded);
        });
        
        // Panel Content
        const panel = document.createElement('div');
        panel.className = 'accordion-panel';
        
        const content = document.createElement('div');
        content.className = 'accordion-content';
        
        // Local Day Presets
        const presetsDiv = document.createElement('div');
        presetsDiv.className = 'local-presets';
        
        let presetButtonsHTML = `
            <button type="button" class="btn-local-preset" data-action="all">Marcar Todos</button>
        `;
        
        if (!isWeekend) {
            presetButtonsHTML += `
                <button type="button" class="btn-local-preset" data-action="shift" data-shift="Noite">Apenas Noite</button>
                <button type="button" class="btn-local-preset" data-action="shift" data-shift="Manhã">Apenas Manhã</button>
            `;
        } else {
            presetButtonsHTML += `
                <button type="button" class="btn-local-preset" data-action="shift" data-shift="Manhã">Apenas Manhã</button>
            `;
        }
        
        presetButtonsHTML += `
            <button type="button" class="btn-local-preset" data-action="clear">Limpar</button>
        `;
        presetsDiv.innerHTML = presetButtonsHTML;
        
        // Add listeners to day local presets
        presetsDiv.querySelectorAll('.btn-local-preset').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const action = btn.dataset.action;
                const checkboxes = content.querySelectorAll(`input[type="checkbox"]`);
                
                if (action === 'all') {
                    checkboxes.forEach(cb => cb.checked = true);
                } else if (action === 'clear') {
                    checkboxes.forEach(cb => cb.checked = false);
                } else if (action === 'shift') {
                    const targetShift = btn.dataset.shift;
                    checkboxes.forEach(cb => {
                        const isTarget = shifts[targetShift].includes(cb.value);
                        cb.checked = isTarget;
                    });
                }
                
                updateDayBadge(day.id);
            });
        });
        
        content.appendChild(presetsDiv);
        
        // Render Shifts and slots
        Object.entries(shifts).forEach(([shiftName, slots]) => {
            const shiftGroup = document.createElement('div');
            shiftGroup.className = 'shift-group';
            shiftGroup.innerHTML = `<h4 class="shift-title">${shiftName}</h4>`;
            
            const grid = document.createElement('div');
            grid.className = 'slots-grid';
            
            slots.forEach(slotTime => {
                const label = document.createElement('label');
                label.className = 'slot-card';
                
                const input = document.createElement('input');
                input.type = 'checkbox';
                input.name = `slots-day-${day.id}`;
                input.value = slotTime;
                
                input.addEventListener('change', () => {
                    updateDayBadge(day.id);
                });
                
                label.appendChild(input);
                label.appendChild(document.createRange().createContextualFragment(`
                    <div class="slot-content">
                        <span class="slot-time">${slotTime}</span>
                    </div>
                `));
                
                grid.appendChild(label);
            });
            
            shiftGroup.appendChild(grid);
            content.appendChild(shiftGroup);
        });
        
        panel.appendChild(content);
        item.appendChild(header);
        item.appendChild(panel);
        accordionDaysContainer.appendChild(item);
    });
}

// Update the badge indicator of selected slots for a specific day
function updateDayBadge(dayId) {
    const item = document.getElementById(`accordion-day-${dayId}`);
    const badge = document.getElementById(`badge-day-${dayId}`);
    const checkedCount = item.querySelectorAll('input[type="checkbox"]:checked').length;
    
    if (checkedCount === 0) {
        badge.textContent = 'Inativo';
        item.classList.remove('has-selections');
    } else {
        badge.textContent = checkedCount === 1 ? '1 horário' : `${checkedCount} horários`;
        item.classList.add('has-selections');
    }
}

// 5. Autocomplete / Searchable Dropdown Logic
function setupAutocompleteInput() {
    clientSearchInput.addEventListener('input', function() {
        const val = this.value;
        closeAllLists();
        if (!val) {
            clearSelection();
            return;
        }
        
        const matches = clientsList.filter(item => 
            item.name.toLowerCase().includes(val.toLowerCase())
        );
        
        if (matches.length === 0) {
            const noMatchDiv = document.createElement("DIV");
            noMatchDiv.innerHTML = "Nenhum cliente encontrado.";
            noMatchDiv.style.color = "#8c8c8c";
            noMatchDiv.style.cursor = "default";
            autocompleteList.appendChild(noMatchDiv);
            autocompleteList.style.display = "block";
            return;
        }
        
        matches.slice(0, 10).forEach(item => {
            const div = document.createElement("DIV");
            const startIdx = item.name.toLowerCase().indexOf(val.toLowerCase());
            const endIdx = startIdx + val.length;
            
            div.innerHTML = item.name.substr(0, startIdx) + 
                            "<strong>" + item.name.substr(startIdx, val.length) + "</strong>" + 
                            item.name.substr(endIdx);
            
            div.addEventListener("click", () => {
                clientSearchInput.value = item.name;
                selectClientItem(item);
                closeAllLists();
            });
            autocompleteList.appendChild(div);
        });
        
        autocompleteList.style.display = "block";
    });

    // Close autocomplete lists when clicking elsewhere
    document.addEventListener("click", (e) => {
        if (e.target !== clientSearchInput) {
            closeAllLists();
        }
    });

    phoneDigitsInput.addEventListener('input', validateIdentificationStep);
}

// Helper to remove any mistakenly created files in parent path
if (window.location.hostname === 'localhost') {
    console.log("Locally running app.js in correct path.");
}

function closeAllLists() {
    autocompleteList.innerHTML = '';
    autocompleteList.style.display = 'none';
}

function selectClientItem(client) {
    selectedClient = client;
    clientSearchInput.value = client.name;
    
    // Show phone verification
    phoneVerificationGroup.style.display = 'block';
    phoneDigitsInput.focus();
    validateIdentificationStep();
}

function clearSelection() {
    selectedClient = null;
    phoneVerificationGroup.style.display = 'none';
    phoneDigitsInput.value = '';
    btnNextStep.disabled = true;
    hideAuthError();
}

function validateIdentificationStep() {
    const isClientSelected = !!selectedClient;
    const isPhoneValid = phoneDigitsInput.value.length === 4 && /^\d+$/.test(phoneDigitsInput.value);
    
    btnNextStep.disabled = !(isClientSelected && isPhoneValid);
}

// 6. Authentication via Supabase RPC
btnNextStep.addEventListener('click', async () => {
    if (!selectedClient) return;
    
    hideAuthError();
    setLoading(true);
    
    const lastDigits = phoneDigitsInput.value;
    const code = selectedClient.customer_code;
    
    try {
        const { data: isValid, error } = await supabaseClient.rpc('fn_mt_verificar_cliente_telefone', {
            p_customer_code: code,
            p_last_digits: lastDigits
        });
        
        if (error) throw error;
        
        if (isValid) {
            // Save authentication token to localStorage
            localStorage.setItem('authenticated_customer_code', code);

            // Fetch existing preferences (to pre-fill)
            await loadExistingPreferences(code);
            
            // Go to next step
            userDisplayName.textContent = selectedClient.name;
            transitionStep(stepIdentification, stepPreferences);
        } else {
            showAuthError("Os 4 últimos dígitos do telefone estão incorretos para o cliente selecionado. Verifique e tente novamente.");
        }
    } catch (err) {
        console.error("Auth error:", err);
        showAuthError("Ocorreu um erro ao validar seus dados no banco. Tente novamente em alguns instantes.");
    } finally {
        setLoading(false);
    }
});

// Fetch existing client preferences to pre-fill the form
async function loadExistingPreferences(customerCode) {
    try {
        const { data, error } = await supabaseClient.rpc('fn_mt_obter_preferencias_cliente', {
            p_customer_code: customerCode
        });
            
        if (error) throw error;
        
        // Reset form first
        resetForm();
        
        if (data && data.length > 0) {
            const prefObj = data[0];
            const prefs = prefObj.preferences || {};
            
            // Check slots checkboxes for each day
            Object.entries(prefs).forEach(([dayId, slots]) => {
                const parsedSlots = slots || [];
                parsedSlots.forEach(slot => {
                    const cb = document.querySelector(`input[name="slots-day-${dayId}"][value="${slot}"]`);
                    if (cb) cb.checked = true;
                });
                updateDayBadge(dayId);
            });
            
            // Set limit
            const maxAlerts = prefObj.max_alerts_per_week || 7;
            frequencyRange.value = maxAlerts;
            frequencyDisplay.textContent = maxAlerts;
        }
    } catch (err) {
        console.warn("Failed to load existing preferences:", err);
    }
}

// 7. Form Submission
preferencesForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!selectedClient) return;
    
    // Collect preferences map
    const preferences = {};
    let totalSelected = 0;
    
    DAYS_OF_WEEK.forEach(day => {
        const checkedList = Array.from(document.querySelectorAll(`input[name="slots-day-${day.id}"]:checked`)).map(cb => cb.value);
        if (checkedList.length > 0) {
            preferences[day.id] = checkedList;
            totalSelected += checkedList.length;
        }
    });
    
    if (totalSelected === 0) {
        alert("Por favor, selecione pelo menos um horário de interesse em algum dia da semana.");
        return;
    }
    
    setLoading(true);
    const code = selectedClient.customer_code;
    const maxAlerts = parseInt(frequencyRange.value);
    
    try {
        const { error } = await supabaseClient.rpc('fn_mt_salvar_preferencias', {
            p_customer_code: code,
            p_preferences: preferences,
            p_max_alerts: maxAlerts
        });
        
        if (error) throw error;
        
        // Success transition
        transitionStep(stepPreferences, stepSuccess);
    } catch (err) {
        console.error("Save error:", err);
        alert("Erro ao salvar preferências no banco de dados. Tente novamente.");
    } finally {
        setLoading(false);
    }
});

// Back / Restart actions
btnChangeUser.addEventListener('click', () => {
    // Clear localStorage authentication on manual change user
    localStorage.removeItem('authenticated_customer_code');

    clearSelection();
    clientSearchInput.disabled = false;
    clientSearchInput.value = '';
    clientSearchInput.style.backgroundColor = '';
    clientSearchInput.style.cursor = '';
    
    transitionStep(stepPreferences, stepIdentification);
});

btnRestart.addEventListener('click', () => {
    transitionStep(stepSuccess, stepPreferences);
});

// Helper functions
function showAuthError(msg) {
    authErrorMsg.textContent = msg;
    authErrorMsg.style.display = 'block';
}

function hideAuthError() {
    authErrorMsg.textContent = '';
    authErrorMsg.style.display = 'none';
}

function setLoading(isLoading) {
    btnNextStep.disabled = isLoading;
    const submitBtn = document.getElementById('btn-submit');
    if (submitBtn) submitBtn.disabled = isLoading;
    
    if (isLoading) {
        btnNextStep.textContent = "Carregando...";
        if (submitBtn) submitBtn.textContent = "Gravando dados...";
    } else {
        btnNextStep.textContent = "Confirmar e Prosseguir";
        if (submitBtn) submitBtn.textContent = "Salvar Preferências";
        validateIdentificationStep();
    }
}

function transitionStep(fromStep, toStep) {
    fromStep.classList.remove('active');
    setTimeout(() => {
        toStep.classList.add('active');
    }, 200);
}

function resetForm() {
    // Clear all checkboxes
    document.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
    
    // Reset all day badges
    DAYS_OF_WEEK.forEach(day => {
        updateDayBadge(day.id);
        const item = document.getElementById(`accordion-day-${day.id}`);
        if (item) item.classList.remove('expanded'); // Collapse all
    });
    
    frequencyRange.value = 7;
    frequencyDisplay.textContent = 7;
}
