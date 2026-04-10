def main():
    import sys
    import os
    from pathlib import Path
    from dotenv import load_dotenv

    BASE_DIR = Path(__file__).resolve().parent

    # Load env file with override=True so it always wins
    load_dotenv(BASE_DIR / '.worker.env', override=True)

    # Set PYTHONPATH to current dir so apps/ is resolvable
    sys.path.insert(0, str(BASE_DIR))
    sys.path.insert(0, str(BASE_DIR / 'apps'))

    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')

    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "Couldn't import Django. Are you sure it's installed and "
            "available on your PYTHONPATH environment variable? Did you "
            "forget to activate a virtual environment?"
        ) from exc

    execute_from_command_line(sys.argv)

if __name__ == '__main__':
    main()