"""One deployment entry point; no shell chaining or network calls."""
import os
from pathlib import Path
from runtime_config import validate_environment
from verify_static_assets import verify


def main():
    validate_environment(os.environ)
    backend = Path(__file__).resolve().parent
    count = verify(backend / 'static', backend / 'release-assets.json')
    print(f'Release preflight: configuration OK; {count} static assets verified')


if __name__ == '__main__':
    main()
