    const plateDefinitions = [
      { id: 'red25kg', name: 'Olympic Red', weight: 25, unit: 'kg', color: '#ef4444', height: 110, width: 18 },
      { id: 'blue20kg', name: 'Olympic Blue', weight: 20, unit: 'kg', color: '#3b82f6', height: 105, width: 17 },
      { id: 'yellow15kg', name: 'Olympic Yellow', weight: 15, unit: 'kg', color: '#eab308', height: 95, width: 16 },
      { id: 'green10kg', name: 'Olympic Green', weight: 10, unit: 'kg', color: '#22c55e', height: 85, width: 14 },
      { id: 'white5kg', name: 'Olympic White', weight: 5, unit: 'kg', color: '#f8fafc', textColor: '#0f172a', height: 70, width: 13 },
      { id: 'orange2d5kg', name: 'Change Orange', weight: 2.5, unit: 'kg', color: '#f97316', height: 58, width: 12 },
      { id: 'yellow1d5kg', name: 'Change Yellow', weight: 1.5, unit: 'kg', color: '#fde047', textColor: '#0f172a', height: 50, width: 11 },
      { id: 'white1kg', name: 'Change White', weight: 1, unit: 'kg', color: '#e2e8f0', textColor: '#0f172a', height: 44, width: 10 },
      
      { id: 'black45lb', name: 'Bumper 45lb', weight: 45, unit: 'lb', color: '#334155', height: 110, width: 18 },
      { id: 'black35lb', name: 'Bumper 35lb', weight: 35, unit: 'lb', color: '#475569', height: 100, width: 17 },
      { id: 'black25lb', name: 'Bumper 25lb', weight: 25, unit: 'lb', color: '#64748b', height: 90, width: 15 },
      { id: 'grey10lb', name: 'Iron 10lb', weight: 10, unit: 'lb', color: '#94a3b8', textColor: '#0f172a', height: 75, width: 13 }
    ];

    const defaultInventory = {
      red25kg: 16, blue20kg: 16, yellow15kg: 16, green10kg: 16, white5kg: 8,
      orange2d5kg: 2, yellow1d5kg: 2, white1kg: 2,
      black45lb: 16, black35lb: 16, black25lb: 16, grey10lb: 16
    };

    let availablePlates = { ...defaultInventory };
    let loadedPlatesPerSide = []; 
    let selectedBarWeightKg = 20;
    
    let collapsedGroupsMap = {};

    let exercises = [
      { id: 1, name: 'Push Ups', weight: 0, unit: 'kg', sets: 3, reps: 30, tempo: '2-0-1-0', isBW: true, date: '2026-03-23' },
      { id: 2, name: 'Dips', weight: 15, unit: 'kg', sets: 3, reps: 8, tempo: '2-0-1-0', isBW: true, date: '2026-03-22' },
      { id: 3, name: 'Squat', weight: 140, unit: 'kg', sets: 3, reps: 5, tempo: '2-0-1-0', isBW: false, date: '2026-03-20' },
      { id: 4, name: 'Bench Press', weight: 105, unit: 'kg', sets: 3, reps: 3, tempo: '2-0-1-0', isBW: false, date: '2026-03-23' },
      { id: 5, name: 'Pull Ups', weight: 0, unit: 'kg', sets: 4, reps: 10, tempo: '2-0-1-0', isBW: true, date: '2026-03-21' },
      { id: 6, name: 'Wall Balls', weight: 9, unit: 'kg', sets: 3, reps: 20, tempo: '1-0-1-0', isBW: false, date: '2026-03-23' }
    ];

    let oneRMManualOverrides = {};

    // Macro Tracker State
    let currentDate = new Date();
    let editingMacroId = null;
    let editingMacroDateKey = null; // which foodLogs[] day-bucket editingMacroId belongs to
    let goals = { cal: 2000, p: 150, c: 200, f: 65 };
    let foodLogs = {}; // Format: 'YYYY-MM-DD': [{ id, name, cal, p, c, f, portion, baseCal, baseP, baseC, baseF }]
    let favourites = [];
    let editingFavouriteId = null;
    let geminiApiKey = '';

    window.onload = function() {
      renderExercises();
      render1RMCard();
      updateSuggestionsSelect();
      calculateFromTarget();
      loadSettings();
      renderDay();

      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js').catch(() => {});
      }

      document.addEventListener('click', function(e) {
        const sugg = document.getElementById('exerciseSuggestions');
        const input = document.getElementById('exerciseName');
        if (sugg && !sugg.contains(e.target) && e.target !== input) {
          sugg.classList.add('hidden');
        }
      });
    };

    function formatTempo(input) {
      if (!input || typeof input !== 'string') return '2-0-1-0';
      let str = input.trim().toUpperCase();
      if (!str) return '2-0-1-0';
      str = str.replace(/[\s,]+/g, '-');
      if (/^[0-9X]{4}$/.test(str)) {
        str = str.split('').join('-');
      }
      str = str.replace(/-+/g, '-');
      return str;
    }

    function isBodyweightMovementName(name) {
      if (!name) return false;
      const lower = name.toLowerCase();
      const bwKeywords = ['push up', 'pushup', 'dip', 'pull up', 'pullup', 'chin up', 'chinup', 'bodyweight', 'muscle up', 'body weight', 'bw', 'wall ball', 'wallball'];
      return bwKeywords.some(kw => lower.includes(kw));
    }

    function syncBWCheckbox(exerciseNameInput) {
      const bwCheckbox = document.getElementById('exerciseBW');
      if (!bwCheckbox) return;
      const name = (exerciseNameInput || '').trim();
      if (!name) return;
      const existingRecord = exercises.find(ex => ex.name.trim().toLowerCase() === name.toLowerCase());
      if (existingRecord) {
        bwCheckbox.checked = !!existingRecord.isBW;
      } else {
        bwCheckbox.checked = isBodyweightMovementName(name);
      }
    }

    function onBWCheckboxChange(context) {
      const isLog = context === 'log';
      const bwCheck = document.getElementById(isLog ? 'exerciseBW' : 'editBW');
      const weightInput = document.getElementById(isLog ? 'exerciseWeight' : 'editWeight');

      if (bwCheck && bwCheck.checked && weightInput) {
        if (!weightInput.value || parseFloat(weightInput.value) === 0) {
          weightInput.value = '0';
        }
      }
    }

    function showToast(msg) {
      const toast = document.getElementById('toastMessage');
      if (toast) {
        toast.textContent = msg;
        toast.classList.remove('hidden');
        setTimeout(() => toast.classList.add('hidden'), 3000);
      }
    }

    function switchTab(tab) {
      const logTab = document.getElementById('logTab');
      const platesTab = document.getElementById('platesTab');
      const macrosTab = document.getElementById('macrosTab');
      const tabBtnLog = document.getElementById('tabBtnLog');
      const tabBtnPlates = document.getElementById('tabBtnPlates');
      const tabBtnMacros = document.getElementById('tabBtnMacros');

      logTab?.classList.add('hidden');
      platesTab?.classList.add('hidden');
      macrosTab?.classList.add('hidden');

      if (tabBtnLog) tabBtnLog.className = "flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all text-slate-300 hover:text-white";
      if (tabBtnPlates) tabBtnPlates.className = "flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all text-slate-300 hover:text-white";
      if (tabBtnMacros) tabBtnMacros.className = "flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all text-slate-300 hover:text-white";

      if (tab === 'log') {
        logTab?.classList.remove('hidden');
        if (tabBtnLog) tabBtnLog.className = "flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all bg-indigo-600 text-white shadow-lg shadow-indigo-500/20";
        renderExercises();
        render1RMCard();
        updateSuggestionsSelect();
      } else if (tab === 'plates') {
        platesTab?.classList.remove('hidden');
        if (tabBtnPlates) tabBtnPlates.className = "flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all bg-indigo-600 text-white shadow-lg shadow-indigo-500/20";
        updateUI();
      } else if (tab === 'macros') {
        macrosTab?.classList.remove('hidden');
        if (tabBtnMacros) tabBtnMacros.className = "flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all bg-indigo-600 text-white shadow-lg shadow-indigo-500/20";
        renderDay();
      }
    }

    function parseTempoDuration(tempoStr) {
      const formatted = formatTempo(tempoStr);
      const parts = formatted.split('-');
      if (parts.length !== 4) return 3.0;
      let total = 0;
      for (let p of parts) {
        const val = p.trim().toUpperCase();
        if (val === 'X') {
          total += 0.5;
        } else {
          const num = parseFloat(val);
          if (isNaN(num)) return 3.0;
          total += num;
        }
      }
      return total;
    }

    function getUniquePreviousExercises() {
      const names = new Set();
      const defaultList = ["Wall Balls", "Push Ups", "Dips", "Pull Ups", "Bench Press", "Squat", "Deadlift", "Shoulder Press", "Push Press", "Barbell Row"];
      defaultList.forEach(n => names.add(n));
      exercises.forEach(e => {
        if (e.name && e.name.trim()) {
          names.add(e.name.trim());
        }
      });
      return Array.from(names);
    }

    function handleExerciseInput() {
      const input = document.getElementById('exerciseName');
      const container = document.getElementById('exerciseSuggestions');
      if (!input || !container) return;
      const query = input.value.trim().toLowerCase();
      syncBWCheckbox(query);
      const uniqueList = getUniquePreviousExercises();
      const matches = uniqueList.filter(name => name.toLowerCase().includes(query));
      if (matches.length === 0) {
        container.classList.add('hidden');
        return;
      }
      container.innerHTML = matches.map(name => `
        <div onclick="selectSuggestion('${name.replace(/'/g, "\\'")}')" 
             class="px-3.5 py-2 hover:bg-indigo-600/30 text-xs text-slate-200 cursor-pointer font-medium transition flex items-center justify-between border-b border-slate-800/50 last:border-0">
          <span>${name}</span>
          <span class="text-[10px] text-slate-500">Select</span>
        </div>
      `).join('');
      container.classList.remove('hidden');
    }

    function selectSuggestion(name) {
      const input = document.getElementById('exerciseName');
      const sugg = document.getElementById('exerciseSuggestions');
      if (input) input.value = name;
      if (sugg) sugg.classList.add('hidden');
      syncBWCheckbox(name);
      document.getElementById('exerciseWeight')?.focus();
    }

    function toggle1RMCard() {
      const content = document.getElementById('oneRMContent');
      const chevron = document.getElementById('oneRMChevron');
      if (content && chevron) {
        if (content.classList.contains('hidden')) {
          content.classList.remove('hidden');
          chevron.textContent = '▲ Hide';
        } else {
          content.classList.add('hidden');
          chevron.textContent = '▼ Show';
        }
      }
    }

    function toggleSuggestionsCard() {
      const content = document.getElementById('suggestionsContent');
      const chevron = document.getElementById('suggestionsChevron');
      if (content && chevron) {
        if (content.classList.contains('hidden')) {
          content.classList.remove('hidden');
          chevron.textContent = '▲ Hide';
        } else {
          content.classList.add('hidden');
          chevron.textContent = '▼ Show';
        }
      }
    }

    function updateSuggestionsSelect() {
      const select = document.getElementById('suggestionExerciseSelect');
      if (!select) return;
      const uniqueNames = Array.from(new Set(exercises.map(e => e.name.trim()))).filter(Boolean);
      if (uniqueNames.length === 0) {
        select.innerHTML = `<option value="">No exercises logged</option>`;
        return;
      }
      const currentVal = select.value;
      select.innerHTML = uniqueNames.map(name => `
        <option value="${name.replace(/"/g, '&quot;')}" ${name === currentVal ? 'selected' : ''}>${name}</option>
      `).join('');
      if (!currentVal || !uniqueNames.includes(currentVal)) {
        select.value = uniqueNames[0];
      }
      onSuggestionExerciseChange();
    }

    function onSuggestionExerciseChange() {
      const select = document.getElementById('suggestionExerciseSelect');
      if (!select) return;
      const selectedName = select.value;
      if (!selectedName) {
        renderWeightSuggestions();
        return;
      }
      let topRecord = null;
      let top1RMKg = -1;
      exercises.forEach(ex => {
        if (ex.name.toLowerCase() === selectedName.toLowerCase()) {
          const wKg = ex.unit === 'kg' ? ex.weight : ex.weight * 0.45359237;
          const systemWeightKg = ex.isBW ? (70 + wKg) : wKg;
          const e1rm = calculate1RM(systemWeightKg, ex.reps);
          if (e1rm > top1RMKg) {
            top1RMKg = e1rm;
            topRecord = ex;
          }
        }
      });
      if (topRecord) {
        const targetSetsInput = document.getElementById('suggestionTargetSets');
        const targetRepsInput = document.getElementById('suggestionTargetReps');
        const targetTempoInput = document.getElementById('suggestionTargetTempo');
        if (targetSetsInput) targetSetsInput.value = topRecord.sets || 3;
        if (targetRepsInput) targetRepsInput.value = topRecord.reps || 10;
        if (targetTempoInput) targetTempoInput.value = formatTempo(topRecord.tempo || '2-0-1-0');
      }
      renderWeightSuggestions();
    }

    function renderWeightSuggestions() {
      const select = document.getElementById('suggestionExerciseSelect');
      const targetSetsInput = document.getElementById('suggestionTargetSets');
      const targetRepsInput = document.getElementById('suggestionTargetReps');
      const targetTempoInput = document.getElementById('suggestionTargetTempo');
      const resultBox = document.getElementById('suggestionResultBox');
      if (!select || !resultBox) return;

      const selectedName = select.value;
      const targetSets = parseInt(targetSetsInput?.value) || 3;
      let targetReps = parseInt(targetRepsInput?.value) || 8;
      const targetTempoStr = formatTempo(targetTempoInput?.value || '2-0-1-0');

      if (!selectedName) {
        resultBox.innerHTML = `<p class="text-xs text-slate-500 italic">No saved records found for suggestion.</p>`;
        return;
      }

      let topRecord = null;
      let top1RMKg = -1;
      exercises.forEach(ex => {
        if (ex.name.toLowerCase() === selectedName.toLowerCase()) {
          const wKg = ex.unit === 'kg' ? ex.weight : ex.weight * 0.45359237;
          const systemWeightKg = ex.isBW ? (75 * 0.68 + wKg) : wKg;
          const e1rm = calculate1RM(systemWeightKg, ex.reps);
          if (e1rm > top1RMKg) {
            top1RMKg = e1rm;
            topRecord = ex;
          }
        }
      });

      if (!topRecord) {
        resultBox.innerHTML = `<p class="text-xs text-slate-500 italic">No saved set found for ${selectedName}.</p>`;
        return;
      }

      const baseSets = topRecord.sets || 3;
      const baseReps = topRecord.reps;
      const baseWeight = topRecord.weight;
      const baseUnit = topRecord.unit;
      const baseTempoStr = formatTempo(topRecord.tempo || '2-0-1-0');
      const isBW = !!topRecord.isBW;

      const baseAddedKg = baseUnit === 'kg' ? baseWeight : baseWeight * 0.45359237;
      const assumedBWKg = 75;
      const systemBaseKg = isBW ? (assumedBWKg * 0.68 + baseAddedKg) : baseAddedKg;
      
      const estimated1RMSystemKg = calculate1RM(systemBaseKg, baseReps);
      const targetSystemKg = estimated1RMSystemKg / (1 + (targetReps / 30));

      const targetRepDuration = parseTempoDuration(targetTempoStr);
      const baseRepDuration = parseTempoDuration(baseTempoStr);
      const tutSetSeconds = Math.round(targetReps * targetRepDuration * 10) / 10;

      const alphaTempo = 1 - 0.025 * (targetRepDuration - baseRepDuration);
      const adjustedTargetSystemKg = targetSystemKg * alphaTempo;

      let targetKgToLoad = 0;
      let targetWeightDisplay = '';

      if (isBW) {
        const suggestedAddedKg = adjustedTargetSystemKg - (assumedBWKg * 0.68);
        targetKgToLoad = suggestedAddedKg > 0 ? Math.round(suggestedAddedKg * 10) / 10 : 0;
        const valInUnit = baseUnit === 'kg' ? Math.max(0, suggestedAddedKg) : Math.max(0, suggestedAddedKg) * 2.20462;
        const roundedAdded = Math.round(valInUnit * 2) / 2;
        targetWeightDisplay = roundedAdded > 0 ? `Body Weight + ${roundedAdded} ${baseUnit}` : `Body Weight`;
      } else {
        targetKgToLoad = Math.round(adjustedTargetSystemKg * 10) / 10;
        const valInUnit = baseUnit === 'kg' ? adjustedTargetSystemKg : adjustedTargetSystemKg * 2.20462;
        const roundedTarget = Math.round(valInUnit * 2) / 2;
        targetWeightDisplay = `${roundedTarget} ${baseUnit}`;
      }

      const tempoPctChange = Math.round((alphaTempo - 1) * 1000) / 10;
      const tempoBadgeClass = tempoPctChange < 0 ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' : 
                              (tempoPctChange > 0 ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' : 'bg-slate-800 text-slate-300 border-slate-700');

      const repGoals = isBW && baseAddedKg === 0 ? [10, 15, 20, 25, 30] : [3, 5, 8, 10, 12];
      const quickTableHtml = repGoals.map(r => {
        const rawTargetSys = estimated1RMSystemKg / (1 + (r / 30));
        const adjSys = rawTargetSys * alphaTempo;
        const isCurrentTarget = r === targetReps;
        
        let displayLabel = '';
        if (isBW) {
          let addKg = adjSys - (assumedBWKg * 0.68);
          if (addKg < 0) addKg = 0;
          const addVal = baseUnit === 'kg' ? addKg : addKg * 2.20462;
          const rAdded = Math.round(addVal * 2) / 2;
          displayLabel = rAdded > 0 ? `Body Weight + ${rAdded}${baseUnit}` : 'Body Weight';
        } else {
          const valForR = baseUnit === 'kg' ? adjSys : adjSys * 2.20462;
          const roundedR = Math.round(valForR * 2) / 2;
          displayLabel = `${roundedR}${baseUnit}`;
        }

        return `
          <div onclick="selectTargetRepsGoal(${r})" class="cursor-pointer p-2 rounded-lg border text-center transition ${isCurrentTarget ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300' : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'}">
            <div class="text-[10px] text-slate-400 font-medium">${targetSets} × ${r} reps</div>
            <div class="text-xs font-extrabold mt-0.5">${displayLabel}</div>
          </div>
        `;
      }).join('');

      const baseWeightDisplay = isBW ? (baseWeight > 0 ? `Body Weight + ${baseWeight} ${baseUnit}` : 'Body Weight') : `${baseWeight} ${baseUnit}`;

      resultBox.innerHTML = `
        <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div>
            <div class="text-xs text-slate-400 flex items-center gap-1">
              <span>🏆 Top Recorded Performance:</span>
            </div>
            <div class="text-sm font-bold text-slate-200">
              ${selectedName}: <span class="text-indigo-400">${baseSets} sets × ${baseReps} reps @ ${baseWeightDisplay}</span> 
              <span class="text-xs text-slate-400 font-mono">(${baseTempoStr})</span>
            </div>
          </div>
          <button onclick="loadSuggestedWeightToPlateCalculator(${targetKgToLoad})" class="px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 rounded-lg text-xs font-semibold flex items-center gap-1 transition">
            🏋️ Load ${targetKgToLoad} kg in Plate Loader
          </button>
        </div>

        <div class="bg-emerald-950/30 border border-emerald-500/30 rounded-lg p-3 text-center space-y-1">
          <div class="text-xs text-emerald-400 font-bold uppercase tracking-wider">Suggested Working Target</div>
          <div class="text-xl sm:text-2xl font-black text-emerald-300 my-0.5">
            ${targetSets} sets × ${targetReps} reps @ ${targetWeightDisplay}
          </div>
          <div class="flex items-center justify-center gap-2 flex-wrap text-[11px]">
            <span class="text-indigo-300">TUT: <strong>${tutSetSeconds}s</strong> / set</span>
            <span class="text-slate-500">•</span>
            <span class="px-1.5 py-0.5 rounded text-[10px] font-semibold border ${tempoBadgeClass}">
              Tempo Adj: ${tempoPctChange > 0 ? '+' : ''}${tempoPctChange}%
            </span>
          </div>
        </div>

        <div>
          <div class="text-[11px] font-semibold text-slate-400 mb-1.5">Quick Target Breakdown (${targetSets} Sets @ Tempo <span class="text-slate-300 font-mono">${targetTempoStr}</span>):</div>
          <div class="grid grid-cols-5 gap-1.5">
            ${quickTableHtml}
          </div>
        </div>
      `;
    }

    function selectTargetRepsGoal(reps) {
      const input = document.getElementById('suggestionTargetReps');
      if (input) {
        input.value = reps;
        renderWeightSuggestions();
      }
    }

    function loadSuggestedWeightToPlateCalculator(targetKg) {
      const targetEl = document.getElementById('targetWeight');
      const unitEl = document.getElementById('loaderUnit');
      if (unitEl) unitEl.value = 'kg';
      if (targetEl) targetEl.value = targetKg;
      switchTab('plates');
      calculateFromTarget();
      showToast(`Loaded ${targetKg} kg into Plate Loader`);
    }

    function calculate1RM(weight, reps) {
      if (weight <= 0 || !reps || reps <= 0) return 0;
      if (reps === 1) return weight;
      return weight * (1 + (reps / 30));
    }

    function render1RMCard() {
      const targetLifts = [
        { key: 'Wall Balls / Thrusters', matchNames: ['wall ball', 'wallball', 'thruster', 'med ball', 'medicine ball'] },
        { key: 'Push Ups / Dips', matchNames: ['push up', 'pushup', 'dip', 'pull up', 'pullup', 'chin up'] },
        { key: 'Shoulder Press / OHP', matchNames: ['shoulder press', 'overhead press', 'ohp', 'military press'] },
        { key: 'Squat', matchNames: ['squat', 'back squat', 'front squat'] },
        { key: 'Bench Press', matchNames: ['bench press', 'bench', 'flat bench'] },
        { key: 'Deadlift', matchNames: ['deadlift', 'sumo deadlift', 'conventional deadlift'] }
      ];

      const grid = document.getElementById('oneRMGrid');
      if (!grid) return;

      grid.innerHTML = targetLifts.map(lift => {
        let best1RMKg = 0;
        let bestSetInfo = 'No sets logged';
        exercises.forEach(ex => {
          const nameLower = ex.name.toLowerCase();
          const matches = lift.matchNames.some(m => nameLower.includes(m));
          if (matches) {
            const wKg = ex.unit === 'kg' ? ex.weight : ex.weight * 0.45359237;
            const e1rmKg = calculate1RM(wKg, ex.reps);
            if (e1rmKg >= best1RMKg) {
              best1RMKg = e1rmKg;
              const wStr = ex.isBW ? (ex.weight > 0 ? `Body Weight + ${ex.weight}${ex.unit}` : 'Body Weight') : `${ex.weight}${ex.unit}`;
              bestSetInfo = `${ex.sets || 3} × ${ex.reps} reps @ ${wStr}`;
            }
          }
        });

        const finalKg = oneRMManualOverrides[lift.key] || best1RMKg;
        const displayKg = (Math.round(finalKg * 10) / 10);
        const displayLb = (Math.round(finalKg * 2.20462 * 10) / 10);

        return `
          <div class="bg-slate-900/80 border border-slate-800 rounded-xl p-3 flex items-center justify-between">
            <div>
              <div class="font-bold text-slate-200">${lift.key}</div>
              <div class="text-[10px] text-slate-400">Top set: ${bestSetInfo}</div>
            </div>
            <div class="text-right">
              <div class="text-sm font-extrabold text-emerald-400">
                ${finalKg > 0 ? `${displayKg} kg` : '--'}
              </div>
              <div class="text-[10px] text-slate-400">
                ${finalKg > 0 ? `${displayLb} lb` : 'Added 1RM'}
              </div>
            </div>
          </div>
        `;
      }).join('');
    }

    function addExercise() {
      const nameInput = document.getElementById('exerciseName');
      const weightInput = document.getElementById('exerciseWeight');
      const unitInput = document.getElementById('exerciseUnit');
      const setsInput = document.getElementById('exerciseSets');
      const repsInput = document.getElementById('exerciseReps');
      const tempoInput = document.getElementById('exerciseTempo');
      const bwInput = document.getElementById('exerciseBW');

      const name = nameInput?.value.trim();
      const rawWeight = parseFloat(weightInput?.value);
      const isBW = bwInput ? bwInput.checked : isBodyweightMovementName(name);
      const weight = isNaN(rawWeight) ? 0 : rawWeight;
      const unit = unitInput?.value || 'kg';
      const sets = parseInt(setsInput?.value) || 3;
      const reps = parseInt(repsInput?.value);
      const tempo = formatTempo(tempoInput?.value || '2-0-1-0');

      if (name && !isNaN(reps)) {
        const today = new Date().toISOString().split('T')[0];
        exercises.unshift({ 
          id: Date.now(), 
          name, 
          weight, 
          unit, 
          sets,
          reps, 
          tempo, 
          isBW,
          date: today 
        });

        if (nameInput) nameInput.value = '';
        if (weightInput) weightInput.value = '';
        if (setsInput) setsInput.value = '3';
        if (repsInput) repsInput.value = '';
        if (tempoInput) tempoInput.value = '2-0-1-0';
        if (bwInput) bwInput.checked = false;
        document.getElementById('exerciseSuggestions')?.classList.add('hidden');

        collapsedGroupsMap[name.toLowerCase()] = false;

        renderExercises();
        render1RMCard();
        updateSuggestionsSelect();
        showToast(`Logged set record for ${name}`);
      }
    }

    function deleteExercise(id) {
      exercises = exercises.filter(e => e.id !== id);
      renderExercises();
      render1RMCard();
      updateSuggestionsSelect();
    }

    function deleteGroup(exerciseName) {
      exercises = exercises.filter(e => e.name.toLowerCase() !== exerciseName.toLowerCase());
      renderExercises();
      render1RMCard();
      updateSuggestionsSelect();
      showToast(`Deleted all records for ${exerciseName}`);
    }

    function openRenameGroupModal(oldDisplayName) {
      const elKey = document.getElementById('renameOldGroupKey');
      const elInput = document.getElementById('renameNewGroupInput');
      if (elKey) elKey.value = oldDisplayName;
      if (elInput) elInput.value = oldDisplayName;
      document.getElementById('renameGroupModal')?.classList.remove('hidden');
    }

    function closeRenameGroupModal() {
      document.getElementById('renameGroupModal')?.classList.add('hidden');
    }

    function saveGroupRename() {
      const oldName = document.getElementById('renameOldGroupKey')?.value.trim();
      const newName = document.getElementById('renameNewGroupInput')?.value.trim();
      if (oldName && newName) {
        exercises = exercises.map(ex => {
          if (ex.name.toLowerCase() === oldName.toLowerCase()) {
            return { ...ex, name: newName };
          }
          return ex;
        });
        closeRenameGroupModal();
        renderExercises();
        render1RMCard();
        updateSuggestionsSelect();
        showToast('Updated exercise group name');
      }
    }

    function openEditModal(id) {
      const record = exercises.find(e => e.id === id);
      if (!record) return;
      document.getElementById('editId').value = record.id;
      document.getElementById('editName').value = record.name;
      document.getElementById('editWeight').value = record.weight;
      document.getElementById('editUnit').value = record.unit;
      document.getElementById('editSets').value = record.sets || 3;
      document.getElementById('editReps').value = record.reps;
      document.getElementById('editTempo').value = formatTempo(record.tempo || '2-0-1-0');
      document.getElementById('editBW').checked = !!record.isBW;
      document.getElementById('editModal')?.classList.remove('hidden');
    }

    function closeEditModal() {
      document.getElementById('editModal')?.classList.add('hidden');
    }

    function saveEditModal() {
      const id = parseInt(document.getElementById('editId')?.value);
      const name = document.getElementById('editName')?.value.trim();
      const rawWeight = parseFloat(document.getElementById('editWeight')?.value);
      const isBW = document.getElementById('editBW')?.checked || false;
      const weight = isNaN(rawWeight) ? 0 : rawWeight;
      const unit = document.getElementById('editUnit')?.value;
      const sets = parseInt(document.getElementById('editSets')?.value) || 3;
      const reps = parseInt(document.getElementById('editReps')?.value);
      const tempo = formatTempo(document.getElementById('editTempo')?.value || '2-0-1-0');

      if (id && name && !isNaN(reps)) {
        exercises = exercises.map(ex => {
          if (ex.id === id) {
            return { ...ex, name, weight, unit, sets, reps, tempo, isBW };
          }
          return ex;
        });
        closeEditModal();
        renderExercises();
        render1RMCard();
        updateSuggestionsSelect();
      }
    }

    function toggleGroupCollapse(groupKey) {
      collapsedGroupsMap[groupKey] = !collapsedGroupsMap[groupKey];
      renderExercises();
    }

    function toggleAllGroups(expand) {
      const searchInput = document.getElementById('searchLog')?.value || '';
      const searchQuery = searchInput.toLowerCase().trim();
      exercises.forEach(ex => {
        const normKey = ex.name.trim().toLowerCase();
        if (!searchQuery || normKey.includes(searchQuery)) {
          collapsedGroupsMap[normKey] = !expand;
        }
      });
      renderExercises();
    }

    function renderExercises() {
      const list = document.getElementById('exercisesList');
      if (!list) return;

      const searchQuery = (document.getElementById('searchLog')?.value || '').toLowerCase().trim();
      const filtered = exercises.filter(ex => ex.name.toLowerCase().includes(searchQuery));

      if (filtered.length === 0) {
        list.innerHTML = `<div class="text-center text-xs text-slate-500 py-8 bg-slate-900/40 rounded-xl border border-slate-800">
          ${searchQuery ? 'No matching exercise records found.' : 'No lifting sets logged yet.'}
        </div>`;
        return;
      }

      const groups = {};
      filtered.forEach(ex => {
        const key = ex.name.trim();
        const normKey = key.toLowerCase();
        if (!groups[normKey]) {
          groups[normKey] = { displayName: key, items: [] };
        }
        groups[normKey].items.push(ex);
      });

      list.innerHTML = Object.keys(groups).map((groupKey) => {
        const group = groups[groupKey];
        const count = group.items.length;
        const isCollapsed = !!collapsedGroupsMap[groupKey];
        const maxSet = group.items.reduce((max, item) => {
          const itemKg = item.unit === 'kg' ? item.weight : item.weight * 0.45359237;
          const maxKg = max.unit === 'kg' ? max.weight : max.weight * 0.45359237;
          return itemKg > maxKg ? item : max;
        }, group.items[0]);

        const maxSetKg = maxSet.unit === 'kg' ? maxSet.weight : Math.round(maxSet.weight * 0.45359237 * 10) / 10;
        const maxSetLb = maxSet.unit === 'lb' ? maxSet.weight : Math.round(maxSet.weight * 2.20462 * 10) / 10;
        const maxSetLabel = maxSet.isBW ? (maxSet.weight > 0 ? `Body Weight + ${maxSetKg} kg` : 'Body Weight') : `${maxSetKg} kg (${maxSetLb} lb)`;

        return `
          <div class="glass-card rounded-xl border border-slate-800 overflow-hidden shadow-md">
            <div class="p-3 bg-slate-900/90 flex items-center justify-between border-b border-slate-800/80">
              <div onclick="toggleGroupCollapse('${groupKey}')" class="flex items-center gap-2.5 cursor-pointer flex-1">
                <span class="text-xs text-indigo-400 font-bold transition-transform">
                  ${isCollapsed ? '▶' : '▼'}
                </span>
                <div>
                  <div class="flex items-center gap-2">
                    <span class="text-sm font-extrabold text-white">${group.displayName}</span>
                    <span class="text-[10px] font-bold px-2 py-0.5 bg-indigo-500/20 text-indigo-300 rounded-full border border-indigo-500/30">
                      ${count} ${count === 1 ? 'record' : 'records'}
                    </span>
                  </div>
                </div>
              </div>
              
              <div class="flex items-center gap-1.5">
                <span class="text-[11px] text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 hidden sm:inline-block">
                  Top: ${maxSetLabel}
                </span>
                <button onclick="openRenameGroupModal('${group.displayName.replace(/'/g, "\\'")}')" class="text-xs px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 transition" title="Rename Exercise Group">
                  ✏️ Rename
                </button>
                <button onclick="deleteGroup('${group.displayName.replace(/'/g, "\\'")}')" class="text-xs text-slate-500 hover:text-rose-400 p-1" title="Delete Entire Group">
                  🗑️
                </button>
              </div>
            </div>

            <div class="${isCollapsed ? 'hidden' : ''} divide-y divide-slate-800/60 bg-slate-950/40">
              ${group.items.map(item => {
                const itemKg = item.unit === 'kg' ? item.weight : Math.round(item.weight * 0.45359237 * 10) / 10;
                const itemLb = item.unit === 'lb' ? item.weight : Math.round(item.weight * 2.20462 * 10) / 10;
                const setVal = item.sets || 3;
                const formattedTempo = formatTempo(item.tempo);

                let weightLabelHtml = '';
                if (item.isBW) {
                  weightLabelHtml = item.weight > 0 ? 
                    `<span class="text-sm font-bold text-emerald-400">Body Weight + ${itemKg} kg <span class="text-xs font-normal text-slate-400">(${itemLb} lb)</span></span>` : 
                    `<span class="text-sm font-bold text-emerald-400">Body Weight</span>`;
                } else {
                  weightLabelHtml = `<span class="text-sm font-bold text-emerald-400">${itemKg} kg <span class="text-xs font-normal text-slate-400">(${itemLb} lb)</span></span>`;
                }

                return `
                <div class="p-3 flex items-center justify-between hover:bg-slate-800/40 transition">
                  <div class="space-y-0.5">
                    <div class="flex items-center gap-2 flex-wrap">
                      ${weightLabelHtml}
                      <span class="text-xs text-slate-300 font-medium">× ${setVal}${setVal === 1 ? 'set' : 'sets'} × ${item.reps} reps</span>${formattedTempo ? `<span class="text-[10px] px-1.5 py-0.5 bg-slate-800 text-slate-400 rounded font-mono">⏱ ${formattedTempo}</span>` : ''}
                    </div>
                    <div class="text-[10px] text-slate-500">${item.date || 'Recent set'}</div>
                  </div>

                  <div class="flex items-center gap-1.5">
                    <button onclick="openEditModal(${item.id})" class="text-xs font-semibold px-2 py-1 bg-slate-800 hover:bg-slate-700 text-indigo-300 rounded transition border border-slate-700">
                      Edit
                    </button>
                    <button onclick="deleteExercise(${item.id})" class="text-xs font-semibold px-2 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded transition">
                      Delete
                    </button>
                  </div>
                </div>
              `;
              }).join('')}
            </div>
          </div>
        `;
      }).join('');
    }

    function getPlateWeightInKg(plate) {
      return plate.unit === 'kg' ? plate.weight : plate.weight * 0.45359237;
    }

    function sortLoadedPlates() {
      loadedPlatesPerSide.sort((a, b) => {
        if (a.unit !== b.unit) {
          return a.unit === 'kg' ? -1 : 1;
        }
        return b.weight - a.weight;
      });
    }

    function calculateTotalWeightKg() {
      const platesSumKg = loadedPlatesPerSide.reduce((sum, p) => {
        return sum + (getPlateWeightInKg(p) * 2);
      }, 0);
      return selectedBarWeightKg + platesSumKg;
    }

    function onBarWeightSelectChange() {
      const barSelect = document.getElementById('barWeight');
      const customContainer = document.getElementById('customBarContainer');
      if (!barSelect) return;
      if (barSelect.value === 'custom') {
        customContainer?.classList.remove('hidden');
        const customVal = parseFloat(document.getElementById('customBarWeight')?.value) || 0;
        selectedBarWeightKg = customVal;
      } else {
        customContainer?.classList.add('hidden');
        selectedBarWeightKg = parseFloat(barSelect.value) || 20;
      }
      calculateFromTarget();
    }

    function onCustomBarInput() {
      const customVal = parseFloat(document.getElementById('customBarWeight')?.value) || 0;
      selectedBarWeightKg = customVal;
      calculateFromTarget();
    }

    function calculateFromTarget() {
      const targetEl = document.getElementById('targetWeight');
      const unitEl = document.getElementById('loaderUnit');
      const targetInput = targetEl ? (parseFloat(targetEl.value) || 0) : 0;
      const unit = unitEl ? unitEl.value : 'kg';
      
      const targetKg = unit === 'kg' ? targetInput : targetInput * 0.45359237;
      let remainingSideKg = Math.max(0, (targetKg - selectedBarWeightKg) / 2);

      loadedPlatesPerSide.forEach(p => {
        availablePlates[p.id] = (availablePlates[p.id] || 0) + 2;
      });

      const sortedAvailable = [...plateDefinitions].sort((a, b) => {
        if (a.unit !== b.unit) {
          return a.unit === 'kg' ? -1 : 1;
        }
        return b.weight - a.weight;
      });

      loadedPlatesPerSide = [];

      for (let plate of sortedAvailable) {
        const pKg = getPlateWeightInKg(plate);
        while (remainingSideKg >= pKg - 0.001 && availablePlates[plate.id] >= 2) {
          loadedPlatesPerSide.push(plate);
          availablePlates[plate.id] -= 2;
          remainingSideKg -= pKg;
        }
      }

      sortLoadedPlates();
      updateUI(false);
    }

    function syncTargetFromLoaded() {
      sortLoadedPlates();
      const totalKg = calculateTotalWeightKg();
      const unitEl = document.getElementById('loaderUnit');
      const unit = unitEl ? unitEl.value : 'kg';
      const totalDisplay = unit === 'kg' ? totalKg : totalKg * 2.20462;
      
      const targetInput = document.getElementById('targetWeight');
      if (targetInput) {
        targetInput.value = (Math.round(totalDisplay * 10) / 10);
      }
      updateUI(false);
    }

    function onTargetInputChanged() {
      calculateFromTarget();
    }

    function onUnitChanged() {
      syncTargetFromLoaded();
    }

    function clearBarbell() {
      loadedPlatesPerSide.forEach(p => {
        availablePlates[p.id] = (availablePlates[p.id] || 0) + 2;
      });
      loadedPlatesPerSide = [];
      syncTargetFromLoaded();
      showToast('Cleared all plates from barbell and returned stock');
    }

    function incrementInventory(e, plateId) {
      if (e) e.stopPropagation();
      availablePlates[plateId] = (availablePlates[plateId] || 0) + 1;
      updateUI(false);
    }

    function decrementInventory(e, plateId) {
      if (e) e.stopPropagation();
      if (availablePlates[plateId] > 0) {
        availablePlates[plateId]--;
        updateUI(false);
      }
    }

    function setInventoryQty(plateId, val, reRenderGrid = false) {
      let parsed = parseInt(val, 10);
      if (isNaN(parsed) || parsed < 0) parsed = 0;
      availablePlates[plateId] = parsed;

      if (reRenderGrid) {
        updateUI(false);
      } else {
        const totalKg = calculateTotalWeightKg();
        const totalLb = totalKg * 2.20462;
        const roundedKg = Math.round(totalKg * 10) / 10;
        const roundedLb = Math.round(totalLb * 10) / 10;
        const totalBadge = document.getElementById('barbellTotalBadge');
        if (totalBadge) {
          totalBadge.textContent = `Total: ${roundedKg} kg / ${roundedLb} lb`;
        }
        renderBarbellSVG();
      }
    }

    function addPlateGraphicClick(plateId) {
      if (availablePlates[plateId] >= 2) {
        availablePlates[plateId] -= 2;
        const plateObj = plateDefinitions.find(p => p.id === plateId);
        if (plateObj) {
          loadedPlatesPerSide.push(plateObj);
          syncTargetFromLoaded();
        }
      } else {
        showToast('Not enough available inventory plates (requires pair)');
      }
    }

    function unloadPlateFromBar(sortedIndex) {
      if (sortedIndex >= 0 && sortedIndex < loadedPlatesPerSide.length) {
        const removedPlate = loadedPlatesPerSide.splice(sortedIndex, 1)[0];
        availablePlates[removedPlate.id] = (availablePlates[removedPlate.id] || 0) + 2;
        syncTargetFromLoaded();
      }
    }

    function resetPlatesInventory() {
      availablePlates = { ...defaultInventory };
      calculateFromTarget();
      showToast('Inventory reset to default stock');
    }

    function renderBarbellSVG() {
      const container = document.getElementById('barbellVisualizer');
      if (!container) return;

      const svgWidth = 800;
      const svgHeight = 210;
      const centerY = 105;

      const barShaftWidth = 360;
      const barShaftX = (svgWidth - barShaftWidth) / 2;
      const barHeight = 12;

      const sleeveWidth = 180;
      const leftSleeveX = barShaftX - sleeveWidth;
      const rightSleeveX = barShaftX + barShaftWidth;

      const collarWidth = 14;
      const collarHeight = 50;

      const baseTotalPlatesWidth = loadedPlatesPerSide.reduce((sum, p) => sum + (p.width * 1.5), 0);
      const maxAvailableSleeveWidth = sleeveWidth - 15;
      const scaleFactor = baseTotalPlatesWidth > maxAvailableSleeveWidth ? (maxAvailableSleeveWidth / baseTotalPlatesWidth) : 1;

      let leftPlateX = barShaftX - collarWidth;
      let rightPlateX = barShaftX + barShaftWidth + collarWidth;

      let leftPlatesMarkup = '';
      let rightPlatesMarkup = '';

      loadedPlatesPerSide.forEach((plate, index) => {
        const pWidth = Math.max(10, plate.width * 1.5 * scaleFactor);
        const pHeight = plate.height * 1.3;
        const pY = centerY - (pHeight / 2);
        const textColor = plate.textColor || '#ffffff';

        const isStackedClose = pWidth < 18;
        const showText = !isStackedClose && pHeight > 45 && pWidth >= 11;
        const fontSize = Math.min(10, Math.max(7, pWidth * 0.65));

        leftPlateX -= pWidth;
        const leftCx = leftPlateX + pWidth / 2;
        const leftCalloutY = pY - 10 - ((index % 2) * 12);

        leftPlatesMarkup += `
          <g class="cursor-pointer plate-hover" onclick="unloadPlateFromBar(${index})">
            <title>Click to unload pair: ${plate.weight} ${plate.unit}</title>
            <rect x="${leftPlateX}" y="${pY}" width="${Math.max(1, pWidth - 1)}" height="${pHeight}" rx="3" fill="${plate.color}" stroke="#0f172a" stroke-width="1.5" />
            <rect x="${leftPlateX + 2}" y="${pY + 3}" width="${Math.max(1, pWidth - 5)}" height="${pHeight - 6}" rx="2" fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="1" />
            
            ${isStackedClose ? `
              <line x1="${leftCx}" y1="${pY}" x2="${leftCx}" y2="${pY + pHeight}" stroke="rgba(255,255,255,0.7)" stroke-width="1" stroke-dasharray="2 2" />
              <line x1="${leftCx}" y1="${pY}" x2="${leftCx}" y2="${leftCalloutY}" stroke="${plate.color}" stroke-width="1.5" stroke-dasharray="2 2" />
              <rect x="${leftCx - 10}" y="${leftCalloutY - 10}" width="20" height="10" rx="2" fill="#0f172a" stroke="${plate.color}" stroke-width="1" />
              <text x="${leftCx}" y="${leftCalloutY - 2}" fill="#ffffff" font-size="8" font-weight="800" font-family="sans-serif" text-anchor="middle">${plate.weight}</text>
            ` : ''}

            ${showText ? `
              <text x="${leftCx}" y="${centerY + 4}" fill="${textColor}" stroke="#0f172a" stroke-width="0.3" font-size="${fontSize}" font-weight="900" font-family="sans-serif" text-anchor="middle" transform="rotate(-90 ${leftCx} ${centerY})">${plate.weight}</text>
            ` : ''}
          </g>
        `;

        const rightCx = rightPlateX + pWidth / 2;
        const rightCalloutY = pY - 10 - ((index % 2) * 12);

        rightPlatesMarkup += `
          <g class="cursor-pointer plate-hover" onclick="unloadPlateFromBar(${index})">
            <title>Click to unload pair: ${plate.weight} ${plate.unit}</title>
            <rect x="${rightPlateX + 1}" y="${pY}" width="${Math.max(1, pWidth - 1)}" height="${pHeight}" rx="3" fill="${plate.color}" stroke="#0f172a" stroke-width="1.5" />
            <rect x="${rightPlateX + 3}" y="${pY + 3}" width="${Math.max(1, pWidth - 5)}" height="${pHeight - 6}" rx="2" fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="1" />
            
            ${isStackedClose ? `
              <line x1="${rightCx}" y1="${pY}" x2="${rightCx}" y2="${pY + pHeight}" stroke="rgba(255,255,255,0.7)" stroke-width="1" stroke-dasharray="2 2" />
              <line x1="${rightCx}" y1="${pY}" x2="${rightCx}" y2="${rightCalloutY}" stroke="${plate.color}" stroke-width="1.5" stroke-dasharray="2 2" />
              <rect x="${rightCx - 10}" y="${rightCalloutY - 10}" width="20" height="10" rx="2" fill="#0f172a" stroke="${plate.color}" stroke-width="1" />
              <text x="${rightCx}" y="${rightCalloutY - 2}" fill="#ffffff" font-size="8" font-weight="800" font-family="sans-serif" text-anchor="middle">${plate.weight}</text>
            ` : ''}

            ${showText ? `
              <text x="${rightCx}" y="${centerY + 4}" fill="${textColor}" stroke="#0f172a" stroke-width="0.3" font-size="${fontSize}" font-weight="900" font-family="sans-serif" text-anchor="middle" transform="rotate(90 ${rightCx} ${centerY})">${plate.weight}</text>
            ` : ''}
          </g>
        `;
        rightPlateX += pWidth;
      });

      container.innerHTML = `
        <svg viewBox="0 0 ${svgWidth} ${svgHeight}" class="w-full h-auto max-h-[220px] select-none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="metalBarGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stop-color="#cbd5e1" />
              <stop offset="50%" stop-color="#64748b" />
              <stop offset="100%" stop-color="#334155" />
            </linearGradient>
            <linearGradient id="sleeveGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stop-color="#94a3b8" />
              <stop offset="50%" stop-color="#475569" />
              <stop offset="100%" stop-color="#1e293b" />
            </linearGradient>
          </defs>

          <rect x="${leftSleeveX}" y="${centerY - 10}" width="${sleeveWidth}" height="20" rx="2" fill="url(#sleeveGrad)" stroke="#334155" />
          <rect x="${rightSleeveX}" y="${centerY - 10}" width="${sleeveWidth}" height="20" rx="2" fill="url(#sleeveGrad)" stroke="#334155" />

          <rect x="${barShaftX}" y="${centerY - barHeight/2}" width="${barShaftWidth}" height="${barHeight}" rx="2" fill="url(#metalBarGrad)" />
          
          <rect x="${barShaftX + 110}" y="${centerY - barHeight/2}" width="140" height="${barHeight}" fill="rgba(0,0,0,0.15)" stroke="rgba(255,255,255,0.1)" stroke-dasharray="2 2" />

          <rect x="${barShaftX - collarWidth}" y="${centerY - collarHeight/2}" width="${collarWidth}" height="${collarHeight}" rx="3" fill="url(#sleeveGrad)" stroke="#0f172a" />
          <rect x="${barShaftX + barShaftWidth}" y="${centerY - collarHeight/2}" width="${collarWidth}" height="${collarHeight}" rx="3" fill="url(#sleeveGrad)" stroke="#0f172a" />

          ${leftPlatesMarkup}
          ${rightPlatesMarkup}

          <text x="${svgWidth / 2}" y="${centerY + 45}" fill="#64748b" font-size="12" font-weight="600" text-anchor="middle">
            Barbell Weight: ${selectedBarWeightKg} kg${loadedPlatesPerSide.length === 0 ? ' (Empty)' : ''}
          </text>
        </svg>
      `;
    }

    function updateUI(recalc = true) {
      const totalKg = calculateTotalWeightKg();
      const totalLb = totalKg * 2.20462;
      const roundedKg = Math.round(totalKg * 10) / 10;
      const roundedLb = Math.round(totalLb * 10) / 10;
      const combinedDisplayStr = `${roundedKg} kg / ${roundedLb} lb`;

      const totalBadge = document.getElementById('barbellTotalBadge');
      if (totalBadge) {
        totalBadge.textContent = `Total: ${combinedDisplayStr}`;
      }

      renderBarbellSVG();
      renderInventoryGrid();
    }

    function renderInventoryGrid() {
      const grid = document.getElementById('platesGrid');
      if (!grid) return;
      
      grid.innerHTML = plateDefinitions.map(plate => {
        const qty = availablePlates[plate.id] || 0;
        const textColor = plate.textColor || '#ffffff';
        const weightLabel = `${plate.weight} ${plate.unit.toUpperCase()}`;

        return `
          <div class="bg-slate-900/80 border border-slate-800 rounded-xl p-3 flex flex-col items-center justify-between text-center transition hover:border-slate-700">
            <div class="text-xs font-extrabold text-white mb-1">
              ${plate.weight} <span class="text-[10px] text-slate-400 font-medium">${plate.unit}</span>
            </div>

            <div onclick="addPlateGraphicClick('${plate.id}')" 
                 class="my-1 cursor-pointer plate-hover flex items-center justify-center p-1.5 rounded-lg bg-slate-950/40 w-full"
                 title="Click plate graphic to load 1 pair onto bar (Deducts 2 from stock)">
              <svg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <path id="topArc_${plate.id}" d="M 13.5,30 A 16.5,16.5 0 0,1 46.5,30" fill="none" />
                  <path id="bottomArc_${plate.id}" d="M 46.5,30 A 16.5,16.5 0 0,1 13.5,30" fill="none" />
                </defs>

                <circle cx="30" cy="30" r="26" fill="${plate.color}" stroke="#0f172a" stroke-width="2" />
                <circle cx="30" cy="30" r="21" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="1" />
                
                <text fill="${textColor}" font-size="6.5" font-weight="800" font-family="sans-serif">
                  <textPath href="#topArc_${plate.id}" startOffset="50%" text-anchor="middle">${weightLabel}</textPath>
                </text>

                <text fill="${textColor}" font-size="6.5" font-weight="800" font-family="sans-serif">
                  <textPath href="#bottomArc_${plate.id}" startOffset="50%" text-anchor="middle">${weightLabel}</textPath>
                </text>

                <circle cx="30" cy="30" r="8.5" fill="#0f172a" stroke="rgba(255,255,255,0.2)" stroke-width="1.5" />
              </svg>
            </div>
            
            <div class="w-full flex items-center justify-between bg-slate-950 rounded-lg p-1 border border-slate-800 mt-1">
              <button onclick="decrementInventory(event, '${plate.id}')" 
                      class="plate-btn-touch w-7 h-7 flex items-center justify-center bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-200 font-bold rounded-md text-sm transition shrink-0">
                -
              </button>
              
              <div class="flex items-center justify-center gap-1 mx-1 min-w-0">
                <span class="text-[10px] text-slate-400 font-medium">Qty:</span>
                <input type="number" min="0" max="99" value="${qty}" 
                       onclick="event.stopPropagation()" 
                       onchange="setInventoryQty('${plate.id}', this.value, true)" 
                       oninput="setInventoryQty('${plate.id}', this.value, false)" 
                       class="w-10 bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-center text-xs font-bold ${qty < 2 ? 'text-rose-400' : 'text-emerald-400'}">
              </div>

              <button onclick="incrementInventory(event, '${plate.id}')" 
                      class="plate-btn-touch w-7 h-7 flex items-center justify-center bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-200 font-bold rounded-md text-sm transition shrink-0">
                +
              </button>
            </div>
          </div>
        `;
      }).join('');
    }

    // Macro Tracker Functions
    function loadSettings() {
      const savedGoals = localStorage.getItem('apex_macro_goals');
      if (savedGoals) {
        try { goals = JSON.parse(savedGoals); } catch(e) {}
      }
      const savedKey = localStorage.getItem('apex_gemini_key');
      if (savedKey) geminiApiKey = savedKey;

      const savedLogs = localStorage.getItem('apex_food_logs');
      if (savedLogs) {
        try { foodLogs = JSON.parse(savedLogs); } catch(e) {}
      }

      const savedFavs = localStorage.getItem('apex_favourites');
      if (savedFavs) {
        try { favourites = JSON.parse(savedFavs); } catch(e) {}
      } else {
        favourites = [
          { id: 101, name: 'Grilled Chicken Breast', cal: 165, p: 31, c: 0, f: 3.6, portion: 1 },
          { id: 102, name: 'Oatmeal & Milk', cal: 250, p: 10, c: 42, f: 5, portion: 1 },
          { id: 103, name: 'Protein Shake (Whey)', cal: 120, p: 24, c: 3, f: 1.5, portion: 1 }
        ];
        saveFavourites();
      }
    }

    function saveFavourites() {
      localStorage.setItem('apex_favourites', JSON.stringify(favourites));
    }

    function saveSettings() {
      const cal = parseInt(document.getElementById('goal-cal-input').value) || 2000;
      const p = parseInt(document.getElementById('goal-p-input').value) || 150;
      const c = parseInt(document.getElementById('goal-c-input').value) || 200;
      const f = parseInt(document.getElementById('goal-f-input').value) || 65;
      const key = document.getElementById('gemini-key-input').value.trim();

      goals = { cal, p, c, f };
      geminiApiKey = key;

      localStorage.setItem('apex_macro_goals', JSON.stringify(goals));
      localStorage.setItem('apex_gemini_key', geminiApiKey);

      closeSettings();
      renderDay();
      showToast('Settings saved');
    }

    function openSettings() {
      document.getElementById('goal-cal-input').value = goals.cal;
      document.getElementById('goal-p-input').value = goals.p;
      document.getElementById('goal-c-input').value = goals.c;
      document.getElementById('goal-f-input').value = goals.f;
      document.getElementById('gemini-key-input').value = geminiApiKey;
      document.getElementById('settings-modal').classList.remove('hidden');
    }

    function closeSettings() {
      document.getElementById('settings-modal').classList.add('hidden');
    }

    function formatDateKey(date) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }

    // Turns a 'YYYY-MM-DD' foodLogs key back into a local Date, avoiding
    // the UTC-midnight parsing shift that `new Date('YYYY-MM-DD')` causes.
    function parseDateKey(key) {
      const [year, month, day] = key.split('-').map(Number);
      return new Date(year, month - 1, day);
    }

    // "Day Month Year" display format, e.g. "23 September 2026".
    function formatDisplayDate(date) {
      const day = date.getDate();
      const month = date.toLocaleDateString('en-US', { month: 'long' });
      const year = date.getFullYear();
      return `${day} ${month} ${year}`;
    }

    // "H:MM AM/PM" display format for a logged item's timestamp. Every
    // food log entry's id is assigned via Date.now() when first logged
    // (and preserved as-is on edits), so it doubles as that entry's
    // logged-at timestamp without needing a separate stored field.
    function formatDisplayTime(msTimestamp) {
      const d = new Date(msTimestamp);
      let hours = d.getHours();
      const minutes = String(d.getMinutes()).padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      if (hours === 0) hours = 12;
      return `${hours}:${minutes} ${ampm}`;
    }

    function changeDate(delta) {
      currentDate.setDate(currentDate.getDate() + delta);
      renderDay();
    }

    function renderDay() {
      const key = formatDateKey(currentDate);

      const dateDisplay = document.getElementById('current-date-display');
      if (dateDisplay) {
        dateDisplay.textContent = formatDisplayDate(currentDate);
      }

      document.getElementById('goal-cal-display').textContent = goals.cal;
      document.getElementById('goal-p-display').textContent = goals.p;
      document.getElementById('goal-c-display').textContent = goals.c;
      document.getElementById('goal-f-display').textContent = goals.f;

      const dayLogs = foodLogs[key] || [];

      let totalCal = 0, totalP = 0, totalC = 0, totalF = 0;
      dayLogs.forEach(item => {
        totalCal += Number(item.cal) || 0;
        totalP += Number(item.p) || 0;
        totalC += Number(item.c) || 0;
        totalF += Number(item.f) || 0;
      });

      document.getElementById('summary-cal').textContent = Math.round(totalCal);
      document.getElementById('summary-p').textContent = `${Math.round(totalP)}g`;
      document.getElementById('summary-c').textContent = `${Math.round(totalC)}g`;
      document.getElementById('summary-f').textContent = `${Math.round(totalF)}g`;

      const barCal = document.getElementById('bar-cal');
      const barP = document.getElementById('bar-p');
      const barC = document.getElementById('bar-c');
      const barF = document.getElementById('bar-f');

      if (barCal) barCal.style.width = `${Math.min(100, (totalCal / goals.cal) * 100)}%`;
      if (barP) barP.style.width = `${Math.min(100, (totalP / goals.p) * 100)}%`;
      if (barC) barC.style.width = `${Math.min(100, (totalC / goals.c) * 100)}%`;
      if (barF) barF.style.width = `${Math.min(100, (totalF / goals.f) * 100)}%`;

      renderFoodList();
      renderFavouritesList();
    }

    // Renders EVERY logged food item across all days (not just the day
    // selected in the Date Navigator above), newest day first, grouped
    // under a day header, and newest item first within each day. The
    // Date Navigator + Daily Summary cards still control which single
    // day's totals/goal progress are shown; this list is the full history.
    function renderFoodList() {
      const listContainer = document.getElementById('food-list');
      if (!listContainer) return;

      const dateKeys = Object.keys(foodLogs).filter(key => (foodLogs[key] || []).length > 0);

      if (dateKeys.length === 0) {
        listContainer.innerHTML = `
          <div class="text-center text-xs text-slate-500 py-6 bg-slate-900/40 rounded-xl border border-slate-800">
            No food items logged yet.
          </div>
        `;
        return;
      }

      // Newest day first ('YYYY-MM-DD' keys sort correctly as strings).
      dateKeys.sort((a, b) => b.localeCompare(a));

      listContainer.innerHTML = dateKeys.map(dateKey => {
        // Newest logged item first within the day (id = Date.now() at log time).
        const items = [...foodLogs[dateKey]].sort((a, b) => (b.id || 0) - (a.id || 0));
        const dayLabel = formatDisplayDate(parseDateKey(dateKey));

        const itemsHtml = items.map(item => {
          const portionLabel = item.portion && item.portion !== 1 ? ` (${item.portion}x portion)` : '';
          const isFav = favourites.some(f => f.name.toLowerCase() === item.name.toLowerCase());
          const timeLabel = formatDisplayTime(item.id);

          return `
            <div class="glass-card p-3 rounded-xl border border-slate-800 flex items-center justify-between hover:border-slate-700 transition">
              <div class="space-y-0.5">
                <div class="text-xs font-bold text-white flex items-center gap-1.5 flex-wrap">
                  <span>${item.name}</span>
                  <span class="text-[10px] text-emerald-400 font-semibold">${portionLabel}</span>
                  <span class="text-[10px] text-slate-500 font-medium">• ${timeLabel}</span>
                </div>
                <div class="text-[11px] text-slate-400 flex items-center gap-2">
                  <span class="font-bold text-slate-200">${item.cal} kcal</span>
                  <span>•</span>
                  <span>P: ${item.p}g</span>
                  <span>C: ${item.c}g</span>
                  <span>F: ${item.f}g</span>
                </div>
              </div>

              <div class="flex items-center gap-1.5">
                <button onclick="toggleSaveAsFavouriteFromLog(${item.id}, '${dateKey}')" class="text-xs px-2 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 rounded border border-amber-500/30 transition" title="${isFav ? 'In Favourites' : 'Save as Favourite'}">
                  ${isFav ? '★ Saved' : '☆ Fav'}
                </button>
                <button onclick="openFormModal(${item.id}, '${dateKey}')" class="text-xs px-2 py-1 bg-slate-800 hover:bg-slate-700 text-indigo-300 rounded border border-slate-700 transition">
                  Edit
                </button>
                <button onclick="deleteFoodEntry(${item.id}, '${dateKey}')" class="text-xs text-slate-500 hover:text-rose-400 p-1" title="Delete Entry">
                  🗑️
                </button>
              </div>
            </div>
          `;
        }).join('');

        return `
          <div class="space-y-2">
            <div class="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-1 pt-1">${dayLabel}</div>
            <div class="space-y-2">
              ${itemsHtml}
            </div>
          </div>
        `;
      }).join('');
    }

    function toggleFavouritesCard() {
      const content = document.getElementById('favsContent');
      const chevron = document.getElementById('favsChevron');
      if (content && chevron) {
        if (content.classList.contains('hidden')) {
          content.classList.remove('hidden');
          chevron.textContent = '▲ Hide';
        } else {
          content.classList.add('hidden');
          chevron.textContent = '▼ Show';
        }
      }
    }

    function renderFavouritesList() {
      const listContainer = document.getElementById('favouritesList');
      if (!listContainer) return;

      const searchInput = (document.getElementById('favSearchInput')?.value || '').toLowerCase().trim();
      const filtered = favourites.filter(f => f.name.toLowerCase().includes(searchInput));

      if (filtered.length === 0) {
        listContainer.innerHTML = `
          <div class="text-center text-xs text-slate-500 py-3 bg-slate-900/40 rounded-xl border border-slate-800">
            ${searchInput ? 'No matching favourite foods found.' : 'No favourites saved yet. Click ☆ Fav on any logged item or check "Save to Favourites" when adding.'}
          </div>
        `;
        return;
      }

      listContainer.innerHTML = filtered.map(fav => `
        <div class="bg-slate-900/80 border border-slate-800 rounded-xl p-2.5 flex items-center justify-between hover:border-amber-500/30 transition">
          <div class="space-y-0.5">
            <div class="text-xs font-bold text-amber-300 flex items-center gap-1">
              <span>⭐ ${fav.name}</span>
            </div>
            <div class="text-[10px] text-slate-400">
              <span class="font-bold text-slate-200">${fav.cal} kcal</span> (P: ${fav.p}g | C: ${fav.c}g | F: ${fav.f}g) per serving
            </div>
          </div>

          <div class="flex items-center gap-1.5">
            <button onclick="addFavouriteToDayPrompt(${fav.id})" class="text-xs px-2.5 py-1 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 font-semibold rounded-lg transition flex items-center gap-1">
              <span>+ Add</span>
            </button>
            <button onclick="openEditFavouriteModal(${fav.id})" class="text-xs px-2 py-1 bg-slate-800 hover:bg-slate-700 text-indigo-300 rounded border border-slate-700 transition" title="Edit Favourite">
              Edit
            </button>
            <button onclick="removeFavourite(${fav.id})" class="text-xs text-slate-500 hover:text-rose-400 p-1" title="Remove Favourite">
              🗑️
            </button>
          </div>
        </div>
      `).join('');
    }

    function addFavouriteToDayPrompt(favId) {
      const fav = favourites.find(f => f.id === favId);
      if (!fav) return;

      editingMacroId = null;
      document.getElementById('modal-title').textContent = `Add Favourite: ${fav.name}`;
      document.getElementById('food-name-input').value = fav.name;
      document.getElementById('food-portion-input').value = fav.portion || 1;
      
      const modal = document.getElementById('entry-modal');
      modal.dataset.baseCal = fav.cal;
      modal.dataset.baseP = fav.p;
      modal.dataset.baseC = fav.c;
      modal.dataset.baseF = fav.f;

      document.getElementById('food-cal-input').value = fav.cal;
      document.getElementById('food-p-input').value = fav.p;
      document.getElementById('food-c-input').value = fav.c;
      document.getElementById('food-f-input').value = fav.f;

      const saveFavCb = document.getElementById('save-as-fav-checkbox');
      if (saveFavCb) saveFavCb.checked = true;

      modal.classList.remove('hidden');
    }

    function onPortionInputChange() {
      const modal = document.getElementById('entry-modal');
      const portionVal = parseFloat(document.getElementById('food-portion-input').value) || 1;
      
      const baseCal = parseFloat(modal.dataset.baseCal);
      const baseP = parseFloat(modal.dataset.baseP);
      const baseC = parseFloat(modal.dataset.baseC);
      const baseF = parseFloat(modal.dataset.baseF);

      if (!isNaN(baseCal)) {
        document.getElementById('food-cal-input').value = Math.round(baseCal * portionVal);
        document.getElementById('food-p-input').value = Math.round(baseP * portionVal * 10) / 10;
        document.getElementById('food-c-input').value = Math.round(baseC * portionVal * 10) / 10;
        document.getElementById('food-f-input').value = Math.round(baseF * portionVal * 10) / 10;
      }
    }

    function removeFavourite(favId) {
      favourites = favourites.filter(f => f.id !== favId);
      saveFavourites();
      renderFavouritesList();
      showToast('Removed from favourites');
    }

    function openEditFavouriteModal(favId) {
      const fav = favourites.find(f => f.id === favId);
      if (!fav) return;

      editingFavouriteId = favId;

      document.getElementById('edit-fav-name-input').value = fav.name;
      document.getElementById('edit-fav-portion-input').value = fav.portion || 1;
      document.getElementById('edit-fav-cal-input').value = fav.cal;
      document.getElementById('edit-fav-p-input').value = fav.p;
      document.getElementById('edit-fav-c-input').value = fav.c;
      document.getElementById('edit-fav-f-input').value = fav.f;

      document.getElementById('edit-favourite-modal')?.classList.remove('hidden');
    }

    function closeEditFavouriteModal() {
      document.getElementById('edit-favourite-modal')?.classList.add('hidden');
      editingFavouriteId = null;
    }

    function saveEditFavourite() {
      if (!editingFavouriteId) return;

      const name = document.getElementById('edit-fav-name-input').value.trim();
      const portion = parseFloat(document.getElementById('edit-fav-portion-input').value) || 1;
      const cal = parseFloat(document.getElementById('edit-fav-cal-input').value) || 0;
      const p = parseFloat(document.getElementById('edit-fav-p-input').value) || 0;
      const c = parseFloat(document.getElementById('edit-fav-c-input').value) || 0;
      const f = parseFloat(document.getElementById('edit-fav-f-input').value) || 0;

      if (!name) {
        showToast('Please enter a food name');
        return;
      }

      const index = favourites.findIndex(fav => fav.id === editingFavouriteId);
      if (index === -1) {
        closeEditFavouriteModal();
        return;
      }

      favourites[index] = { ...favourites[index], name, portion, cal, p, c, f };

      saveFavourites();
      closeEditFavouriteModal();
      renderFavouritesList();
      showToast(`Updated "${name}" in favourites`);
    }

    function toggleSaveAsFavouriteFromLog(itemId, dateKey) {
      const key = dateKey || formatDateKey(currentDate);
      const dayLogs = foodLogs[key] || [];
      const item = dayLogs.find(i => i.id === itemId);
      if (!item) return;

      const existingIndex = favourites.findIndex(f => f.name.toLowerCase() === item.name.toLowerCase());
      if (existingIndex >= 0) {
        favourites.splice(existingIndex, 1);
        showToast(`Removed "${item.name}" from favourites`);
      } else {
        const basePortion = item.portion || 1;
        const baseCal = Math.round(item.cal / basePortion);
        const baseP = Math.round((item.p / basePortion) * 10) / 10;
        const baseC = Math.round((item.c / basePortion) * 10) / 10;
        const baseF = Math.round((item.f / basePortion) * 10) / 10;

        favourites.push({
          id: Date.now(),
          name: item.name,
          cal: baseCal,
          p: baseP,
          c: baseC,
          f: baseF,
          portion: 1
        });
        showToast(`Saved "${item.name}" to favourites`);
      }

      saveFavourites();
      renderDay();
    }

    function openFormModal(id = null, dateKey = null) {
      editingMacroId = id;
      editingMacroDateKey = id ? (dateKey || formatDateKey(currentDate)) : null;
      const modal = document.getElementById('entry-modal');
      const titleEl = document.getElementById('modal-title');
      const saveFavCb = document.getElementById('save-as-fav-checkbox');

      delete modal.dataset.baseCal;
      delete modal.dataset.baseP;
      delete modal.dataset.baseC;
      delete modal.dataset.baseF;

      if (id) {
        const key = editingMacroDateKey;
        const item = (foodLogs[key] || []).find(i => i.id === id);
        if (item) {
          if (titleEl) titleEl.textContent = 'Edit Food Entry';
          document.getElementById('food-name-input').value = item.name;
          document.getElementById('food-portion-input').value = item.portion || 1;
          document.getElementById('food-cal-input').value = item.cal;
          document.getElementById('food-p-input').value = item.p;
          document.getElementById('food-c-input').value = item.c;
          document.getElementById('food-f-input').value = item.f;

          const basePortion = item.portion || 1;
          modal.dataset.baseCal = item.baseCal || Math.round(item.cal / basePortion);
          modal.dataset.baseP = item.baseP || (item.p / basePortion);
          modal.dataset.baseC = item.baseC || (item.c / basePortion);
          modal.dataset.baseF = item.baseF || (item.f / basePortion);

          if (saveFavCb) {
            saveFavCb.checked = favourites.some(f => f.name.toLowerCase() === item.name.toLowerCase());
          }
        }
      } else {
        if (titleEl) titleEl.textContent = 'Add Food Entry';
        document.getElementById('food-name-input').value = '';
        document.getElementById('food-portion-input').value = 1;
        document.getElementById('food-cal-input').value = '';
        document.getElementById('food-p-input').value = '';
        document.getElementById('food-c-input').value = '';
        document.getElementById('food-f-input').value = '';
        if (saveFavCb) saveFavCb.checked = false;
      }

      modal.classList.remove('hidden');
    }

    function closeFormModal() {
      document.getElementById('entry-modal').classList.add('hidden');
      editingMacroId = null;
      editingMacroDateKey = null;
    }

    function saveFoodEntry() {
      const name = document.getElementById('food-name-input').value.trim();
      const portion = parseFloat(document.getElementById('food-portion-input').value) || 1;
      const cal = parseFloat(document.getElementById('food-cal-input').value) || 0;
      const p = parseFloat(document.getElementById('food-p-input').value) || 0;
      const c = parseFloat(document.getElementById('food-c-input').value) || 0;
      const f = parseFloat(document.getElementById('food-f-input').value) || 0;
      const saveAsFav = document.getElementById('save-as-fav-checkbox')?.checked || false;

      if (!name) {
        showToast('Please enter a food name');
        return;
      }

      // Editing an existing entry writes back to the day it was originally
      // logged under; adding a new entry always logs to the selected day.
      const key = editingMacroId ? (editingMacroDateKey || formatDateKey(currentDate)) : formatDateKey(currentDate);
      if (!foodLogs[key]) foodLogs[key] = [];

      const modal = document.getElementById('entry-modal');
      const baseCal = modal.dataset.baseCal ? parseFloat(modal.dataset.baseCal) : Math.round(cal / portion);
      const baseP = modal.dataset.baseP ? parseFloat(modal.dataset.baseP) : Math.round((p / portion) * 10) / 10;
      const baseC = modal.dataset.baseC ? parseFloat(modal.dataset.baseC) : Math.round((c / portion) * 10) / 10;
      const baseF = modal.dataset.baseF ? parseFloat(modal.dataset.baseF) : Math.round((f / portion) * 10) / 10;

      if (editingMacroId) {
        foodLogs[key] = foodLogs[key].map(item => {
          if (item.id === editingMacroId) {
            return { id: item.id, name, cal, p, c, f, portion, baseCal, baseP, baseC, baseF };
          }
          return item;
        });
      } else {
        foodLogs[key].push({
          id: Date.now(),
          name,
          cal,
          p,
          c,
          f,
          portion,
          baseCal,
          baseP,
          baseC,
          baseF
        });
      }

      if (saveAsFav) {
        const existingFavIndex = favourites.findIndex(fav => fav.name.toLowerCase() === name.toLowerCase());
        const favObj = {
          id: existingFavIndex >= 0 ? favourites[existingFavIndex].id : Date.now(),
          name,
          cal: baseCal,
          p: baseP,
          c: baseC,
          f: baseF,
          portion: 1
        };
        if (existingFavIndex >= 0) {
          favourites[existingFavIndex] = favObj;
        } else {
          favourites.push(favObj);
        }
        saveFavourites();
      }

      localStorage.setItem('apex_food_logs', JSON.stringify(foodLogs));
      closeFormModal();
      renderDay();
      showToast(editingMacroId ? 'Updated food entry' : 'Added food entry');
    }

    function deleteFoodEntry(id, dateKey) {
      const key = dateKey || formatDateKey(currentDate);
      if (foodLogs[key]) {
        foodLogs[key] = foodLogs[key].filter(item => item.id !== id);
        localStorage.setItem('apex_food_logs', JSON.stringify(foodLogs));
        renderDay();
        showToast('Food entry deleted');
      }
    }

    // Preferred Gemini model for image/label analysis. If this model ever
    // becomes unavailable (deprecated/renamed), findWorkingGeminiModel()
    // below automatically searches the live model list and falls back to
    // the best available alternative, so the app keeps working without
    // needing a manual code update.
    const GEMINI_PREFERRED_MODEL = 'gemini-3.8-flash';
    const GEMINI_FALLBACK_MODELS = ['gemini-2.5-flash', 'gemini-flash-lite-latest', 'gemini-1.5-flash'];
    let cachedWorkingGeminiModel = null;

    // Asks the Gemini API which models are actually available to this key
    // and picks the newest-looking Flash-family model that supports
    // generateContent (image input). Used only as a fallback if the
    // preferred/fallback model names above stop working.
    async function findWorkingGeminiModel(apiKey) {
      const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
      const res = await fetch(listUrl);
      if (!res.ok) throw new Error(`Could not list Gemini models (HTTP ${res.status})`);
      const data = await res.json();
      const models = (data.models || [])
        .filter(m => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent'))
        .map(m => (m.name || '').replace(/^models\//, ''))
        .filter(id => /flash|pro/i.test(id) && !/vision-latest|deprecated/i.test(id));

      if (models.length === 0) throw new Error('No usable Gemini models found for this API key');

      // Prefer "flash" models (fast + vision-capable + cheaper), newest version first.
      models.sort((a, b) => {
        const aFlash = /flash/i.test(a) ? 1 : 0;
        const bFlash = /flash/i.test(b) ? 1 : 0;
        if (aFlash !== bFlash) return bFlash - aFlash;
        return b.localeCompare(a, undefined, { numeric: true });
      });

      return models[0];
    }

    // Tries the preferred model, then known fallbacks, then a live search
    // of available models — returning the first model name that actually
    // succeeds a generateContent call with the given payload.
    async function callGeminiVision(apiKey, payload) {
      const candidates = [GEMINI_PREFERRED_MODEL, ...GEMINI_FALLBACK_MODELS];
      if (cachedWorkingGeminiModel && !candidates.includes(cachedWorkingGeminiModel)) {
        candidates.unshift(cachedWorkingGeminiModel);
      }

      let lastError = null;
      for (const modelId of candidates) {
        try {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;
          const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          if (response.ok) {
            cachedWorkingGeminiModel = modelId;
            return { modelId, data: await response.json() };
          }
          lastError = new Error(`${modelId} responded with HTTP ${response.status}`);
        } catch (err) {
          lastError = err;
        }
      }

      // Every known model name failed — search the live model list for a
      // working alternative as a last resort.
      const discoveredModel = await findWorkingGeminiModel(apiKey);
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${discoveredModel}:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        throw new Error(`API Error ${response.status} (last tried: ${discoveredModel}). ${lastError ? lastError.message : ''}`.trim());
      }
      cachedWorkingGeminiModel = discoveredModel;
      return { modelId: discoveredModel, data: await response.json() };
    }

    function setScanStatus(message, isError) {
      const statusEl = document.getElementById('scan-status');
      const statusText = document.getElementById('scan-status-text');
      if (!statusEl || !statusText) return;
      statusEl.classList.remove('hidden');
      statusText.textContent = message;
      statusEl.classList.toggle('border-rose-500/50', !!isError);
      statusEl.classList.toggle('border-emerald-500/30', !isError);
      const icon = statusEl.querySelector('i');
      if (icon) {
        icon.className = isError
          ? 'fa-solid fa-triangle-exclamation text-rose-400 text-xl'
          : 'fa-solid fa-circle-notch fa-spin text-emerald-400 text-xl';
      }
      statusText.classList.toggle('text-rose-300', !!isError);
      statusText.classList.toggle('text-slate-200', !isError);
    }

    async function handleImageScan(event) {
      const file = event.target.files[0];
      if (!file) return;

      if (!geminiApiKey) {
        showToast('Please configure Gemini API key in Settings first!');
        openSettings();
        return;
      }

      // Starting a new scan always resets any error left visible from a
      // previous attempt.
      setScanStatus(`Connecting to Gemini (${cachedWorkingGeminiModel || GEMINI_PREFERRED_MODEL})...`, false);

      try {
        const reader = new FileReader();
        reader.onload = async function(e) {
          try {
            const base64Data = e.target.result.split(',')[1];
            const mimeType = file.type || 'image/jpeg';

            const promptText = "Analyze this food image or nutritional label. Identify the food item and estimate/extract the nutrition facts per serving: food name, calories (kcal), protein (g), carbs (g), fat (g). Return ONLY a JSON object with keys: name (string), cal (number), p (number), c (number), f (number). Do not include markdown code block formatting.";

            const payload = {
              contents: [{
                parts: [
                  { text: promptText },
                  {
                    inline_data: {
                      mime_type: mimeType,
                      data: base64Data
                    }
                  }
                ]
              }]
            };

            setScanStatus(`Analyzing image with ${cachedWorkingGeminiModel || GEMINI_PREFERRED_MODEL}...`, false);

            const { modelId, data } = await callGeminiVision(geminiApiKey, payload);
            setScanStatus(`Analyzing image with ${modelId}...`, false);

            const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
            const cleanText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();

            let parsed = {};
            try {
              parsed = JSON.parse(cleanText);
            } catch (err) {
              throw new Error(`${modelId} returned a response that could not be parsed as JSON`);
            }

            document.getElementById('scan-status')?.classList.add('hidden');

            openFormModal();
            document.getElementById('food-name-input').value = parsed.name || 'Scanned Food Item';
            document.getElementById('food-cal-input').value = parsed.cal || 0;
            document.getElementById('food-p-input').value = parsed.p || 0;
            document.getElementById('food-c-input').value = parsed.c || 0;
            document.getElementById('food-f-input').value = parsed.f || 0;

            showToast(`Image analyzed with ${modelId}! Verify values and save.`);
          } catch (err) {
            // Leave the error message visible in the scan status card
            // (rather than hiding it) until the next scan is started.
            setScanStatus(`AI Scan failed: ${err.message || 'Unknown error'}`, true);
          }
        };
        reader.onerror = function() {
          setScanStatus('AI Scan failed: could not read the selected image file', true);
        };
        reader.readAsDataURL(file);
      } catch (err) {
        setScanStatus(`AI Scan failed: ${err.message || 'Unknown error'}`, true);
      }
    }
