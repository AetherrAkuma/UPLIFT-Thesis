import re

with open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Extract sections
navbar = re.search(r'<!-- Navbar -->(.*?)</nav>', content, re.DOTALL).group(0)
footer = re.search(r'<!-- Toast Notifications -->(.*?)</html>', content, re.DOTALL).group(0)

# Also extract modals
login_modal = re.search(r'<!-- Login Modal -->(.*?)</div>\s*</div>\s*</div>', content, re.DOTALL).group(0)
register_modal = re.search(r'<!-- Register Modal -->(.*?)</div>\s*</div>\s*</div>', content, re.DOTALL).group(0)
analyzing_modal = re.search(r'<!-- AI Analyzing Modal -->(.*?)</div>\s*</div>\s*</div>', content, re.DOTALL).group(0)
profile_modal = re.search(r'<!-- Profile Setup Modal -->(.*?)</div>\s*</div>\s*</div>', content, re.DOTALL).group(0)

# Extract views
landing_view = re.search(r'<!-- 1\. LANDING PAGE -->(.*?)</section>', content, re.DOTALL).group(0)
dashboard_view = re.search(r'<!-- 2\. PWD DASHBOARD \(Semantic Search Layout\) -->(.*?)</section>', content, re.DOTALL).group(0)
employer_view = re.search(r'<!-- 3\. EMPLOYER VIEW \(Kept compatible\) -->(.*?)</section>', content, re.DOTALL).group(0)
admin_view = re.search(r'<!-- 4\. ADMIN VIEW \(Kept compatible\) -->(.*?)</section>', content, re.DOTALL).group(0)

head = '''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>UPLIFT | Inclusive Employment</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Lexend:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="style.css">
</head>
<body class="min-h-screen flex flex-col bg-slate-50 text-slate-800 antialiased font-sans">
'''

# Update the navbar links to point to the new HTML files
nav_updated = navbar.replace('onclick="switchView(\'landing-view\')"', 'href="index.html"')
nav_updated = nav_updated.replace('onclick="switchView(\'pwd-dashboard-view\')"', 'onclick="window.location.href=\'dashboard.html\'"')
nav_updated = nav_updated.replace('onclick="switchView(\'employer-view\')"', 'onclick="window.location.href=\'employer.html\'"')
nav_updated = nav_updated.replace('onclick="switchView(\'admin-view\')"', 'onclick="window.location.href=\'admin.html\'"')
nav_updated = nav_updated.replace('onclick="openModal(\'profile-modal\'); toggleDropdown(\'profile-dropdown\')"', 'onclick="window.location.href=\'profile.html\'"')
# Remove the old dropdown link logic for tabs
nav_updated = nav_updated.replace('onclick="switchView(\'pwd-dashboard-view\'); switchTab(\'tab-profile\')"', 'onclick="window.location.href=\'profile.html\'"')

# Remove "hidden" from the view sections
landing_view = landing_view.replace('hidden', '', 1)
dashboard_view = dashboard_view.replace('class="view-section hidden', 'class="view-section')
employer_view = employer_view.replace('class="view-section hidden', 'class="view-section')
admin_view = admin_view.replace('class="view-section hidden', 'class="view-section')


# 1. index.html
with open('index.html', 'w', encoding='utf-8') as f:
    f.write(head + nav_updated + '\n<main class="flex-grow relative">\n' + landing_view + '\n</main>\n' + login_modal + '\n' + register_modal + '\n' + footer)

# 2. dashboard.html
with open('dashboard.html', 'w', encoding='utf-8') as f:
    f.write(head + nav_updated + '\n<main class="flex-grow relative">\n' + dashboard_view + '\n</main>\n' + analyzing_modal + '\n' + footer)

# 3. employer.html
with open('employer.html', 'w', encoding='utf-8') as f:
    f.write(head + nav_updated + '\n<main class="flex-grow relative">\n' + employer_view + '\n</main>\n' + footer)

# 4. admin.html
with open('admin.html', 'w', encoding='utf-8') as f:
    f.write(head + nav_updated + '\n<main class="flex-grow relative">\n' + admin_view + '\n</main>\n' + footer)

# 5. profile.html (We will write the custom layout here)
# For now just dump the modal content into a main layout
profile_content = """
<section class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 fade-in">
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <!-- Left Sidebar -->
        <div class="lg:col-span-4 space-y-6">
            <div class="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 text-center">
                <div class="w-24 h-24 mx-auto bg-blue-100 rounded-full flex items-center justify-center text-3xl font-black text-blue-700 mb-4" id="sidebar-initials">U</div>
                <h2 class="text-xl font-bold text-slate-900" id="sidebar-name">User Name</h2>
                <p class="text-sm text-slate-500 mb-6" id="sidebar-email">user@example.com</p>
                
                <div class="text-left mb-6">
                    <div class="flex justify-between text-xs font-bold text-slate-700 mb-1">
                        <span>Profile Completion</span>
                        <span class="text-blue-600">85%</span>
                    </div>
                    <div class="w-full bg-slate-100 rounded-full h-2">
                        <div class="bg-blue-600 h-2 rounded-full" style="width: 85%"></div>
                    </div>
                </div>

                <div class="grid grid-cols-3 gap-3 text-center mb-4">
                    <div class="bg-slate-50 p-2 rounded-lg border border-slate-100">
                        <i class="fa-solid fa-briefcase text-blue-400 mb-1"></i>
                        <p class="text-xs font-bold text-slate-700">3</p>
                        <p class="text-[10px] text-slate-400 uppercase">Matches</p>
                    </div>
                    <div class="bg-slate-50 p-2 rounded-lg border border-slate-100">
                        <i class="fa-solid fa-bolt text-indigo-400 mb-1"></i>
                        <p class="text-xs font-bold text-slate-700">12</p>
                        <p class="text-[10px] text-slate-400 uppercase">Skills</p>
                    </div>
                    <div class="bg-slate-50 p-2 rounded-lg border border-slate-100">
                        <i class="fa-solid fa-bookmark text-emerald-400 mb-1"></i>
                        <p class="text-xs font-bold text-slate-700">2</p>
                        <p class="text-[10px] text-slate-400 uppercase">Saved</p>
                    </div>
                </div>
            </div>
        </div>

        <!-- Right Content Area -->
        <div class="lg:col-span-8">
            <div class="bg-white rounded-t-2xl border border-slate-200 border-b-0 p-2 flex flex-wrap gap-2">
                <button onclick="switchProfileTab('tab-summary')" id="btn-tab-summary" class="profile-tab active px-4 py-2 text-sm font-bold rounded-lg transition-colors flex items-center gap-2 bg-blue-600 text-white shadow-sm"><i class="fa-regular fa-user"></i> Summary</button>
                <button onclick="switchProfileTab('tab-disabilities')" id="btn-tab-disabilities" class="profile-tab px-4 py-2 text-sm font-bold rounded-lg transition-colors flex items-center gap-2 text-slate-500 hover:bg-slate-50 border border-transparent"><i class="fa-solid fa-wheelchair"></i> Disabilities</button>
                <button onclick="switchProfileTab('tab-preferences')" id="btn-tab-preferences" class="profile-tab px-4 py-2 text-sm font-bold rounded-lg transition-colors flex items-center gap-2 text-slate-500 hover:bg-slate-50 border border-transparent"><i class="fa-solid fa-sliders"></i> Job Preferences</button>
            </div>
            
            <div class="bg-white p-6 rounded-b-2xl rounded-tr-2xl border border-slate-200 shadow-sm min-h-[400px]">
                
                <!-- Tab: Summary & Skills -->
                <div id="tab-summary" class="profile-tab-content">
                    <h3 class="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2"><i class="fa-solid fa-file-lines text-blue-500"></i> Professional Summary & Skills</h3>
                    <textarea id="pwd-capabilities" rows="4" placeholder="e.g., I have 3 years of experience in data entry. I require a quiet environment." class="w-full p-4 border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all text-sm bg-slate-50 resize-none mb-4"></textarea>
                    
                    <label class="block text-sm font-bold text-slate-700 mb-2">Technical & Soft Skills</label>
                    <input type="text" id="pwd-skills" placeholder="e.g., typing, computer, communication" class="w-full p-3 border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all text-sm bg-slate-50">
                </div>

                <!-- Tab: Disabilities -->
                <div id="tab-disabilities" class="profile-tab-content hidden">
                    <h3 class="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2"><i class="fa-solid fa-wheelchair text-blue-500"></i> Disability Checklist</h3>
                    <div id="disability-checklist" class="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar p-1">
                        <!-- Dynamic Accordion Groups (from script) -->
                    </div>
                    <div id="selected-summary" class="flex flex-wrap gap-2 mt-4 min-h-[30px] p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <span class="text-xs text-slate-400 italic self-center">No selection made yet</span>
                    </div>
                </div>

                <!-- Tab: Preferences -->
                <div id="tab-preferences" class="profile-tab-content hidden">
                    <h3 class="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2"><i class="fa-solid fa-sliders text-blue-500"></i> AI Matching Weights</h3>
                    <div class="space-y-6 max-w-xl">
                        <div>
                            <div class="flex justify-between text-sm font-bold text-slate-700 mb-2">
                                <label>Skill Match</label>
                                <span id="val-skill" class="text-blue-600 bg-blue-50 px-2 py-0.5 rounded">40%</span>
                            </div>
                            <input type="range" id="weight-skill" min="0" max="1" step="0.05" value="0.40" class="w-full accent-blue-600 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer" oninput="document.getElementById('val-skill').innerText=Math.round(this.value*100)+'%'">
                        </div>
                        <div>
                            <div class="flex justify-between text-sm font-bold text-slate-700 mb-2">
                                <label>Safety (Accessibility)</label>
                                <span id="val-semantic" class="text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">40%</span>
                            </div>
                            <input type="range" id="weight-semantic" min="0" max="1" step="0.05" value="0.40" class="w-full accent-indigo-600 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer" oninput="document.getElementById('val-semantic').innerText=Math.round(this.value*100)+'%'">
                        </div>
                        <div>
                            <div class="flex justify-between text-sm font-bold text-slate-700 mb-2">
                                <label>Stamina & Fit</label>
                                <span id="val-stamina" class="text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">20%</span>
                            </div>
                            <input type="range" id="weight-stamina" min="0" max="1" step="0.05" value="0.20" class="w-full accent-emerald-600 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer" oninput="document.getElementById('val-stamina').innerText=Math.round(this.value*100)+'%'">
                        </div>
                    </div>
                </div>

            </div>
            
            <div class="flex items-center justify-between mt-6">
                <span id="profile-saved-text" class="text-sm font-bold text-emerald-600 opacity-0 transition-opacity"><i class="fa-solid fa-check mr-1"></i> Profile Saved</span>
                <div class="flex gap-4">
                    <button onclick="window.location.href='dashboard.html'" class="px-6 py-2.5 rounded-xl border-2 border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-colors">Back to Dashboard</button>
                    <button onclick="saveProfileLocally(); document.getElementById('profile-saved-text').classList.remove('opacity-0'); setTimeout(()=>document.getElementById('profile-saved-text').classList.add('opacity-0'), 2000)" class="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-bold shadow-sm transition-colors">Save Profile</button>
                </div>
            </div>
        </div>
    </div>
</section>
"""

with open('profile.html', 'w', encoding='utf-8') as f:
    f.write(head + nav_updated + '\n<main class="flex-grow relative">\n' + profile_content + '\n</main>\n' + footer)

print("Files split successfully.")
