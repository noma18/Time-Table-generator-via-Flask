from flask import Flask, render_template, request, jsonify
import random
from collections import defaultdict

app = Flask(__name__)

class TimetableGenerator:
    def __init__(self):
        self.reset()
        
    def reset(self):
        self.teachers = {}
        self.subjects = set()
        self.classes = []
        self.lectures_per_day = 0
        self.lecture_duration = 0
        self.start_time = "09:00"
        self.break_after = 3
        self.break_duration = 30
        self.timetables = {}
        self.global_teacher_availability = {}  # Tracks all teachers across all classes

    def validate_inputs(self, data):
        if not data.get('lectures_per_day') or not data.get('lecture_duration'):
            return False, "Please specify lectures per day and duration"
        if not data.get('teachers') or len(data['teachers']) == 0:
            return False, "Please add at least one teacher"
        if not data.get('subjects') or len(data['subjects']) == 0:
            return False, "Please add at least one subject"
        return True, ""

    def generate_timetable(self, data):
        self.reset()  # Critical: Reset all state for new generation
        
        try:
            # Parse inputs
            self.lectures_per_day = int(data['lectures_per_day'])
            self.lecture_duration = int(data['lecture_duration'])
            self.start_time = data.get('start_time', "09:00")
            self.break_after = int(data.get('break_after', 3))
            self.break_duration = int(data.get('break_duration', 30))
            class_names = data.get('class_names', ['Class 1'])
            self.subjects = set(data['subjects'])
            
            # Initialize teacher tracking
            for teacher in data['teachers']:
                self.teachers[teacher['name']] = teacher['subjects']
                self.global_teacher_availability[teacher['name']] = {
                    day: [True] * (self.lectures_per_day + 1)  # +1 for break slot
                    for day in ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
                }
            
            # Generate timetables with real-time conflict prevention
            self.timetables = {}
            for class_name in class_names:
                timetable = self._generate_class_timetable(class_name)
                if not timetable:
                    return False, f"Failed to generate timetable for {class_name}"
                self.timetables[class_name] = timetable
            
            return True, self.timetables
        except Exception as e:
            return False, str(e)

    def _generate_class_timetable(self, class_name):
        timetable = {day: [] for day in ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']}
        time_slots = self._calculate_time_slots()
        
        for day in timetable.keys():
            scheduled_subjects = set()
            
            for slot_idx, slot in enumerate(time_slots):
                if slot['is_break']:
                    timetable[day].append({
                        'time': slot['time'],
                        'subject': 'RECESS',
                        'teacher': '',
                        'is_break': True
                    })
                    continue
                
                # Find available subject-teacher pairs
                available = []
                for subject in (self.subjects - scheduled_subjects):
                    for teacher, subjects in self.teachers.items():
                        if subject in subjects and self.global_teacher_availability[teacher][day][slot_idx]:
                            available.append((subject, teacher))
                
                if available:
                    # Prioritize teachers with most constraints
                    available.sort(key=lambda x: sum(
                        1 for d in self.global_teacher_availability[x[1]]
                        for s in self.global_teacher_availability[x[1]][d]
                        if not s
                    ))
                    
                    subject, teacher = available[0]
                    self.global_teacher_availability[teacher][day][slot_idx] = False
                    scheduled_subjects.add(subject)
                    
                    timetable[day].append({
                        'time': slot['time'],
                        'subject': subject,
                        'teacher': teacher,
                        'is_break': False
                    })
                else:
                    timetable[day].append({
                        'time': slot['time'],
                        'subject': 'FREE PERIOD',
                        'teacher': '',
                        'is_break': False
                    })
        
        return timetable

    def _calculate_time_slots(self):
        time_slots = []
        current_hour, current_min = map(int, self.start_time.split(':'))
        break_added = False
        
        for i in range(self.lectures_per_day + 1):  # +1 to include break slot
            if i == self.break_after and not break_added:
                # Add break slot
                time_slots.append({
                    'time': f"{current_hour:02d}:{current_min:02d}",
                    'is_break': True
                })
                current_min += self.break_duration
                break_added = True
                if current_min >= 60:
                    current_hour += current_min // 60
                    current_min = current_min % 60
                continue
            
            # Add lecture slot
            time_slots.append({
                'time': f"{current_hour:02d}:{current_min:02d}",
                'is_break': False
            })
            current_min += self.lecture_duration
            if current_min >= 60:
                current_hour += current_min // 60
                current_min = current_min % 60
        
        return time_slots

generator = TimetableGenerator()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/generate', methods=['POST'])
def generate():
    data = request.get_json()
    success, message = generator.validate_inputs(data)
    
    if not success:
        return jsonify({'success': False, 'message': message})
    
    success, result = generator.generate_timetable(data)
    
    if success:
        # Final verification (should always pass with new implementation)
        conflicts = []
        for day in ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']:
            teacher_slots = defaultdict(set)
            for class_tt in result.values():
                for slot in class_tt.get(day, []):
                    if slot['teacher']:
                        if slot['time'] in teacher_slots[slot['teacher']]:
                            conflicts.append(f"{slot['teacher']} double-booked at {slot['time']} on {day}")
                        teacher_slots[slot['teacher']].add(slot['time'])
        
        if conflicts:
            return jsonify({'success': False, 'message': 'Implementation error!', 'conflicts': conflicts})
        
        return jsonify({'success': True, 'timetables': result})
    else:
        return jsonify({'success': False, 'message': result})

if __name__ == '__main__':
    app.run(debug=True)