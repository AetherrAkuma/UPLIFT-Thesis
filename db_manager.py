import psycopg2
from psycopg2.extras import RealDictCursor
import json
import sys
import os
from server import get_db_connection

def get_db():
    try:
        conn = get_db_connection()
        return conn
    except Exception as e:
        print(f"Error: Could not connect to PostgreSQL database. Details: {e}")
        sys.exit(1)

def list_users():
    conn = get_db()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    cursor.execute("SELECT id, email, name, role, status FROM users")
    users = cursor.fetchall()
    print("\n--- USERS ---")
    print(f"{'Email':<30} | {'Name':<20} | {'Role':<10} | {'Status':<10}")
    print("-" * 80)
    for u in users:
        print(f"{u['email']:<30} | {u['name']:<20} | {u['role']:<10} | {u['status']:<10}")
    conn.close()

def update_user_status(email, new_status):
    conn = get_db()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    cursor.execute("UPDATE users SET status = %s WHERE email = %s", (new_status, email))
    conn.commit()
    if cursor.rowcount > 0:
        print(f"Success: User {email} status updated to {new_status}")
    else:
        print(f"Error: User {email} not found.")
    conn.close()

def update_user_role(email, new_role):
    conn = get_db()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    cursor.execute("UPDATE users SET role = %s WHERE email = %s", (new_role, email))
    conn.commit()
    if cursor.rowcount > 0:
        print(f"Success: User {email} role updated to {new_role}")
    else:
        print(f"Error: User {email} not found.")
    conn.close()

def delete_user(email):
    conn = get_db()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    cursor.execute("DELETE FROM users WHERE email = %s", (email,))
    conn.commit()
    if cursor.rowcount > 0:
        print(f"Success: User {email} deleted.")
    else:
        print(f"Error: User {email} not found.")
    conn.close()

def list_jobs():
    conn = get_db()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    cursor.execute("SELECT id, job_title, employer_name, status FROM jobs")
    jobs = cursor.fetchall()
    print("\n--- JOBS ---")
    print(f"{'Title':<30} | {'Employer':<20} | {'Status':<10}")
    print("-" * 70)
    for j in jobs:
        print(f"{j['job_title']:<30} | {j['employer_name']:<20} | {j['status']:<10}")
    conn.close()

def approve_job(job_id_partial):
    conn = get_db()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    cursor.execute("UPDATE jobs SET status = 'approved' WHERE id LIKE %s", (f"{job_id_partial}%",))
    conn.commit()
    if cursor.rowcount > 0:
        print(f"Success: Job matching {job_id_partial} approved.")
    else:
        print(f"Error: Job not found.")
    conn.close()

def main():
    while True:
        print("\n=== UPLIFT DB MANAGER (DEV MODE) ===")
        print("1. List Users")
        print("2. Approve Employer (Set status to 'active')")
        print("3. Change User Role (user/employer/admin)")
        print("4. Delete User")
        print("5. List Jobs")
        print("6. Approve Job")
        print("7. Exit")
        
        choice = input("\nSelect an option: ")
        
        if choice == '1':
            list_users()
        elif choice == '2':
            email = input("Enter user email to approve: ")
            update_user_status(email, 'active')
        elif choice == '3':
            email = input("Enter user email: ")
            role = input("Enter new role (user/employer/admin): ")
            update_user_role(email, role)
        elif choice == '4':
            email = input("Enter user email to DELETE: ")
            confirm = input(f"Are you sure you want to delete {email}? (y/n): ")
            if confirm.lower() == 'y':
                delete_user(email)
        elif choice == '5':
            list_jobs()
        elif choice == '6':
            job_id = input("Enter Job ID (or start of it) to approve: ")
            approve_job(job_id)
        elif choice == '7':
            break
        else:
            print("Invalid choice.")

if __name__ == "__main__":
    main()
