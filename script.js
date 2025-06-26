document.addEventListener('DOMContentLoaded', function() {
    // Add initial teacher
    addTeacher();
    
    // Event listeners
    document.getElementById('addTeacher').addEventListener('click', addTeacher);
    document.getElementById('generateBtn').addEventListener('click', generateTimetable);
    document.getElementById('resetBtn').addEventListener('click', resetForm);
    document.getElementById('numClasses').addEventListener('change', updateClassNames);
    
    // Initialize class names
    updateClassNames();
});

function addTeacher() {
    const container = document.getElementById('teachersContainer');
    const teacherDiv = document.createElement('div');
    teacherDiv.className = 'teacher-entry animate__animated animate__fadeIn';
    teacherDiv.innerHTML = `
        <input type="text" class="teacher-name" placeholder="Teacher Name">
        <input type="text" class="teacher-subjects" placeholder="Subjects (comma separated)">
        <button class="remove-teacher">×</button>
    `;
    container.appendChild(teacherDiv);
    
    // Add event listener to remove button
    teacherDiv.querySelector('.remove-teacher').addEventListener('click', function() {
        teacherDiv.classList.add('animate__fadeOut');
        setTimeout(() => {
            container.removeChild(teacherDiv);
        }, 500);
    });
}

function updateClassNames() {
    const numClasses = parseInt(document.getElementById('numClasses').value);
    const container = document.getElementById('classNamesContainer');
    container.innerHTML = '';
    
    if (numClasses > 1) {
        container.innerHTML = '<p>Enter class names:</p>';
        for (let i = 0; i < numClasses; i++) {
            const div = document.createElement('div');
            div.className = 'class-name-input';
            div.innerHTML = `
                <input type="text" class="className" placeholder="Class ${i+1} Name" 
                       value="Class ${i+1}" required>
            `;
            container.appendChild(div);
        }
    }
}

function generateTimetable() {
    // Get basic configuration
    const className = document.getElementById('className').value || 'Class 1';
    const lecturesPerDay = parseInt(document.getElementById('lecturesPerDay').value);
    const lectureDuration = parseInt(document.getElementById('lectureDuration').value);
    const startTime = document.getElementById('startTime').value;
    const breakAfter = parseInt(document.getElementById('breakAfter').value);
    const breakDuration = parseInt(document.getElementById('breakDuration').value);
    const numClasses = parseInt(document.getElementById('numClasses').value);
    
    // Get class names
    let classNames = [className];
    if (numClasses > 1) {
        const classInputs = document.querySelectorAll('.className');
        classNames = Array.from(classInputs).map(input => input.value || input.placeholder);
    }
    
    // Get teachers and subjects
    const teachers = [];
    const teacherEntries = document.querySelectorAll('.teacher-entry');
    
    teacherEntries.forEach(entry => {
        const name = entry.querySelector('.teacher-name').value.trim();
        const subjects = entry.querySelector('.teacher-subjects').value
            .split(',')
            .map(s => s.trim())
            .filter(s => s !== '');
        
        if (name && subjects.length > 0) {
            teachers.push({
                name: name,
                subjects: subjects
            });
        }
    });
    
    // Validate inputs
    if (lecturesPerDay <= 0 || isNaN(lecturesPerDay)) {
        alert('Please enter a valid number of lectures per day');
        return;
    }
    
    if (lectureDuration <= 0 || isNaN(lectureDuration)) {
        alert('Please enter a valid lecture duration');
        return;
    }
    
    if (teachers.length === 0) {
        alert('Please add at least one teacher with subjects');
        return;
    }
    
    // Prepare data for API
    const data = {
        class_names: classNames,
        lectures_per_day: lecturesPerDay,
        lecture_duration: lectureDuration,
        start_time: startTime,
        break_after: breakAfter,
        break_duration: breakDuration,
        teachers: teachers,
        subjects: Array.from(new Set(teachers.flatMap(t => t.subjects)))
    };
    
    // Show loading state
    const generateBtn = document.getElementById('generateBtn');
    generateBtn.disabled = true;
    generateBtn.textContent = 'Generating...';
    generateBtn.classList.add('pulse');
    
    // Send request to backend
    fetch('/generate', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
    })
    .then(response => response.json())
    // .then(data => {
    //     generateBtn.disabled = false;
    //     generateBtn.textContent = 'Generate Timetable';
    //     generateBtn.classList.remove('pulse');
        
    //     if (data.success) {
    //         displayTimetables(data.timetables);
    //     } else {
    //         alert('Error: ' + data.message);
    //     }
    // })
    .then(data => {
        generateBtn.disabled = false;
        generateBtn.textContent = 'Generate Timetable';
        generateBtn.classList.remove('pulse');
        
        if (data.success) {
            displayTimetables(data.timetables);
        } else if (data.conflicts) {
            alert('Conflicts detected:\n' + data.conflicts.join('\n'));
        } else {
            alert('Error: ' + data.message);
        }
    })
    .catch(error => {
        generateBtn.disabled = false;
        generateBtn.textContent = 'Generate Timetable';
        generateBtn.classList.remove('pulse');
        alert('An error occurred: ' + error.message);
    });
}

function displayTimetables(timetables) {
    const container = document.getElementById('timetablesContainer');
    container.innerHTML = '';
    
    // Show results section
    document.getElementById('results').classList.remove('hidden');
    
    // Create timetable for each class
    for (const [className, timetable] of Object.entries(timetables)) {
        const timetableDiv = document.createElement('div');
        timetableDiv.className = 'timetable animate__animated animate__fadeIn';
        
        const title = document.createElement('h3');
        title.textContent = className;
        timetableDiv.appendChild(title);
        
        const table = document.createElement('table');
        
        // Create header row
        const headerRow = document.createElement('tr');
        headerRow.innerHTML = '<th>Time</th>' + 
            ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
                .map(day => `<th>${day}</th>`).join('');
        table.appendChild(headerRow);
        
        // Create time slots (assuming all days have same number of lectures)
        const days = Object.keys(timetable);
        const timeSlots = timetable[days[0]].length;
        
        for (let i = 0; i < timeSlots; i++) {
            const row = document.createElement('tr');
            if (timetable[days[0]][i].is_break) {
                row.className = 'break-row';
            }
            
            // Add time cell
            const timeCell = document.createElement('td');
            timeCell.textContent = timetable[days[0]][i].time;
            row.appendChild(timeCell);
            
            // Add day cells
            for (const day of days) {
                const cell = document.createElement('td');
                const slot = timetable[day][i];
                
                if (slot.is_break) {
                    cell.textContent = 'RECESS';
                    cell.colSpan = 1;
                } else {
                    cell.innerHTML = `<strong>${slot.subject}</strong><br>${slot.teacher}`;
                }
                
                row.appendChild(cell);
            }
            
            table.appendChild(row);
        }
        
        timetableDiv.appendChild(table);
        container.appendChild(timetableDiv);
    }
}

function resetForm() {
    // Reset configuration
    document.getElementById('className').value = '';
    document.getElementById('lecturesPerDay').value = '6';
    document.getElementById('lectureDuration').value = '45';
    document.getElementById('startTime').value = '09:00';
    document.getElementById('breakAfter').value = '3';
    document.getElementById('breakDuration').value = '30';
    document.getElementById('numClasses').value = '1';
    
    // Reset teachers
    const teachersContainer = document.getElementById('teachersContainer');
    teachersContainer.innerHTML = '';
    addTeacher(); // Add one default teacher
    
    // Reset class names
    updateClassNames();
    
    // Hide results
    document.getElementById('results').classList.add('hidden');
}