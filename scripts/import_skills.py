import os
import shutil

def parse_yaml_frontmatter(file_path):
    """
    Parses YAML frontmatter manually to avoid external dependencies (like PyYAML).
    """
    if not os.path.exists(file_path):
        return None
    
    with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
        lines = f.readlines()
        
    if not lines or lines[0].strip() != "---":
        return None
        
    frontmatter_lines = []
    for line in lines[1:]:
        if line.strip() == "---":
            break
        frontmatter_lines.append(line)
    else:
        # No closing marker
        return None
        
    # Simple YAML parser for key-value pairs
    data = {}
    for line in frontmatter_lines:
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if ":" in line:
            parts = line.split(":", 1)
            key = parts[0].strip()
            val = parts[1].strip()
            # Strip quotes if present
            if (val.startswith('"') and val.endswith('"')) or (val.startswith("'") and val.endswith("'")):
                val = val[1:-1]
            data[key] = val
            
    return data

def copy_skill_dir(src, dst):
    """
    Copies a skill directory, following/resolving symlinks.
    """
    if os.path.exists(dst):
        shutil.rmtree(dst)
    
    # We use symlinks=False to dereference symlinks during copy
    shutil.copytree(src, dst, symlinks=False)
    print(f"Imported skill: {os.path.basename(src)}")

def main():
    workspace_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    agents_dir = os.path.join(workspace_root, ".agents")
    skills_dir = os.path.join(agents_dir, "skills")
    
    # Ensure directories exist
    os.makedirs(skills_dir, exist_ok=True)
    
    # 1. UI/UX Pro Max Skill
    ui_ux_src = os.path.join(workspace_root, "ui-ux-pro-max-skill", ".claude", "skills", "ui-ux-pro-max")
    ui_ux_dst = os.path.join(skills_dir, "ui-ux-pro-max")
    if os.path.exists(ui_ux_src):
        copy_skill_dir(ui_ux_src, ui_ux_dst)
    else:
        print(f"WARNING: ui-ux-pro-max source not found at {ui_ux_src}")
        
    # 2. Lighthouse Skill
    lh_src = os.path.join(workspace_root, "lighthouse", ".agents", "skills", "lighthouse-verification")
    lh_dst = os.path.join(skills_dir, "lighthouse-verification")
    if os.path.exists(lh_src):
        copy_skill_dir(lh_src, lh_dst)
    else:
        print(f"WARNING: lighthouse-verification source not found at {lh_src}")
        
    # 3. Anthropic Cybersecurity Skills
    cyber_src_dir = os.path.join(workspace_root, "Anthropic-Cybersecurity-Skills", "skills")
    if os.path.exists(cyber_src_dir):
        for item in os.listdir(cyber_src_dir):
            item_path = os.path.join(cyber_src_dir, item)
            if os.path.isdir(item_path):
                skill_md_path = os.path.join(item_path, "SKILL.md")
                if os.path.exists(skill_md_path):
                    copy_skill_dir(item_path, os.path.join(skills_dir, item))
    else:
        print(f"WARNING: Cybersecurity skills directory not found at {cyber_src_dir}")
        
    # 4. GStack Skills
    gstack_src_dir = os.path.join(workspace_root, "gstack")
    if os.path.exists(gstack_src_dir):
        # 4a. GStack core router skill (from root SKILL.md)
        gstack_core_md = os.path.join(gstack_src_dir, "SKILL.md")
        if os.path.exists(gstack_core_md):
            gstack_core_dst = os.path.join(skills_dir, "gstack")
            os.makedirs(gstack_core_dst, exist_ok=True)
            shutil.copy2(gstack_core_md, os.path.join(gstack_core_dst, "SKILL.md"))
            print("Imported GStack core router skill")
            
        # 4b. Subdirectory skills under gstack/
        for item in os.listdir(gstack_src_dir):
            # Ignore standard non-skill folders
            if item in [".git", ".github", "node_modules", "bin", "lib", "docs", "supabase"]:
                continue
            item_path = os.path.join(gstack_src_dir, item)
            if os.path.isdir(item_path):
                skill_md_path = os.path.join(item_path, "SKILL.md")
                if os.path.exists(skill_md_path):
                    copy_skill_dir(item_path, os.path.join(skills_dir, item))
                    
        # 4c. Rules (AGENTS.md)
        gstack_agents_md = os.path.join(gstack_src_dir, "AGENTS.md")
        if os.path.exists(gstack_agents_md):
            shutil.copy2(gstack_agents_md, os.path.join(agents_dir, "AGENTS.md"))
            print(f"Imported GStack rules -> {os.path.join(agents_dir, 'AGENTS.md')}")
    else:
        print(f"WARNING: gstack directory not found at {gstack_src_dir}")
        
    # 5. Verification Phase
    print("\n--- Starting Verification Phase ---")
    all_skills = os.listdir(skills_dir)
    total_skills = 0
    valid_skills = 0
    invalid_skills = []
    
    for skill_name in all_skills:
        skill_path = os.path.join(skills_dir, skill_name)
        if not os.path.isdir(skill_path):
            continue
            
        total_skills += 1
        skill_md = os.path.join(skill_path, "SKILL.md")
        if not os.path.exists(skill_md):
            print(f"INVALID: Skill '{skill_name}' has no SKILL.md")
            invalid_skills.append((skill_name, "Missing SKILL.md"))
            continue
            
        frontmatter = parse_yaml_frontmatter(skill_md)
        if not frontmatter:
            print(f"INVALID: Skill '{skill_name}' has invalid or missing YAML frontmatter in SKILL.md")
            invalid_skills.append((skill_name, "Invalid/Missing YAML frontmatter"))
            continue
            
        name_val = frontmatter.get("name")
        desc_val = frontmatter.get("description")
        
        if not name_val or not desc_val:
            print(f"INVALID: Skill '{skill_name}' is missing 'name' or 'description' in YAML frontmatter")
            invalid_skills.append((skill_name, f"Missing name/description (name={name_val}, desc={desc_val})"))
            continue
            
        valid_skills += 1
        
    print(f"\nVerification Results:")
    print(f"Total skills directories scanned: {total_skills}")
    print(f"Valid skills: {valid_skills}")
    print(f"Invalid skills: {len(invalid_skills)}")
    
    if invalid_skills:
        print("\nInvalid Skills List:")
        for name, reason in invalid_skills:
            print(f" - {name}: {reason}")
    else:
        print("\nAll skills successfully verified and are valid!")

if __name__ == "__main__":
    main()
