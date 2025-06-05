#!/usr/bin/env python3
"""
Download flag images based on actual player data
Reads player_list.json and downloads flags for all countries found
"""

import os
import json
import requests
from pathlib import Path
import time
from typing import Set, Dict


def load_player_countries(json_file: str = "./tennis-scrollytelling/data/player_list.json") -> Set[str]:
    """Load player data and extract all unique country codes"""
    try:
        with open(json_file, 'r', encoding='utf-8') as f:
            players = json.load(f)

        countries = set()
        for player in players:
            if 'country' in player and player['country']:
                countries.add(player['country'].upper())

        print(f"📊 Found {len(players)} players from {len(countries)} countries")
        print(f"🌍 Countries: {sorted(countries)}")
        return countries

    except FileNotFoundError:
        print(f"❌ Could not find {json_file}")
        print("📁 Make sure the player_list.json file exists in ./data/")
        return set()
    except json.JSONDecodeError:
        print(f"❌ Invalid JSON in {json_file}")
        return set()


def get_iso_mapping() -> Dict[str, str]:
    """Tennis country codes to ISO country codes mapping"""
    return {
        # Americas
        'ARG': 'AR',  # Argentina
        'BRA': 'BR',  # Brazil
        'CAN': 'CA',  # Canada
        'CHI': 'CL',  # Chile
        'COL': 'CO',  # Colombia
        'ECU': 'EC',  # Ecuador
        'MEX': 'MX',  # Mexico
        'PAR': 'PY',  # Paraguay
        'PER': 'PE',  # Peru
        'URU': 'UY',  # Uruguay
        'USA': 'US',  # United States
        'VEN': 'VE',  # Venezuela
        'BOL': 'BO',  # Bolivia

        # Europe
        'SUI': 'CH',  # Switzerland
        'GER': 'DE',  # Germany
        'GBR': 'GB',  # Great Britain
        'GRE': 'GR',  # Greece
        'SLO': 'SI',  # Slovenia
        'DEN': 'DK',  # Denmark
        'NED': 'NL',  # Netherlands
        'CRO': 'HR',  # Croatia
        'CZE': 'CZ',  # Czech Republic
        'SVK': 'SK',  # Slovakia
        'BUL': 'BG',  # Bulgaria
        'ROU': 'RO',  # Romania
        'POR': 'PT',  # Portugal
        'BEL': 'BE',  # Belgium
        'AUT': 'AT',  # Austria
        'SWE': 'SE',  # Sweden
        'NOR': 'NO',  # Norway
        'FIN': 'FI',  # Finland
        'ISL': 'IS',  # Iceland
        'IRL': 'IE',  # Ireland
        'POL': 'PL',  # Poland
        'HUN': 'HU',  # Hungary
        'UKR': 'UA',  # Ukraine
        'BLR': 'BY',  # Belarus
        'RUS': 'RU',  # Russia
        'BIH': 'BA',  # Bosnia and Herzegovina
        'CYP': 'CY',  # Cyprus
        'LAT': 'LV',  # Latvia
        'LUX': 'LU',  # Luxembourg

        # Historical codes
        'TCH': 'CZ',  # Czechoslovakia -> Czech Republic
        'YUG': 'RS',  # Yugoslavia -> Serbia
        'URS': 'RU',  # USSR -> Russia
        'FRG': 'DE',  # West Germany -> Germany
        'GDR': 'DE',  # East Germany -> Germany

        # Asia-Pacific
        'VIE': 'VN',  # Vietnam
        'TPE': 'TW',  # Taiwan
        'HKG': 'HK',  # Hong Kong
        'SIN': 'SG',  # Singapore
        'MAS': 'MY',  # Malaysia
        'PHI': 'PH',  # Philippines
        'INA': 'ID',  # Indonesia
        'THA': 'TH',  # Thailand
        'JPN': 'JP',  # Japan
        'KOR': 'KR',  # South Korea
        'CHN': 'CN',  # China
        'IND': 'IN',  # India
        'PAK': 'PK',  # Pakistan
        'AUS': 'AU',  # Australia
        'NZL': 'NZ',  # New Zealand
        'UZB': 'UZ',  # Uzbekistan
        'KAZ': 'KZ',  # Kazakhstan
        'GEO': 'GE',  # Georgia
        'ARM': 'AM',  # Armenia

        # Africa & Middle East
        'RSA': 'ZA',  # South Africa
        'EGY': 'EG',  # Egypt
        'MAR': 'MA',  # Morocco
        'TUN': 'TN',  # Tunisia
        'ISR': 'IL',  # Israel

        # Common ones that are the same
        'ESP': 'ES',  # Spain
        'FRA': 'FR',  # France
        'ITA': 'IT',  # Italy
        'SRB': 'RS',  # Serbia
    }


def download_flag(country_code: str, iso_code: str, flags_dir: Path) -> bool:
    """Download flag image from various sources"""

    # Check if already exists
    existing_files = list(flags_dir.glob(f"{country_code.lower()}.*"))
    if existing_files:
        print(f"  ⏭️  Already exists: {existing_files[0].name}")
        return True

    # Multiple reliable sources - simplified
    sources = [
        # FlagCDN - very reliable, supports all ISO codes
        f"https://flagcdn.com/w80/{iso_code.lower()}.png",
        f"https://flagcdn.com/h60/{iso_code.lower()}.png",
        f"https://flagcdn.com/{iso_code.lower()}.svg",

        # Flagpedia - good backup
        f"https://flagpedia.net/data/flags/w160/{iso_code.lower()}.png",
        f"https://flagpedia.net/data/flags/icon/{iso_code.lower()}.png",

        # Wikipedia commons (very comprehensive)
        f"https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/Flag_of_{iso_code}.svg/80px-Flag_of_{iso_code}.svg.png",
    ]

    for i, url in enumerate(sources):
        try:
            print(f"  📡 Trying source {i + 1}: {url.split('/')[-2:]}")

            response = requests.get(url, timeout=15, headers={
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            })
            response.raise_for_status()

            # Check if we got actual image data
            if len(response.content) < 100:  # Too small to be a real image
                print(f"  ⚠️  Response too small ({len(response.content)} bytes)")
                continue

            # Determine file extension
            if url.endswith('.svg'):
                ext = 'svg'
            elif url.endswith('.webp'):
                ext = 'webp'
            else:
                ext = 'png'

            # Save the image
            filename = flags_dir / f"{country_code.lower()}.{ext}"
            with open(filename, 'wb') as f:
                f.write(response.content)

            print(f"  ✅ Downloaded: {filename.name} ({len(response.content):,} bytes)")
            return True

        except requests.exceptions.RequestException as e:
            print(f"  ❌ Failed: {e}")
            continue
        except Exception as e:
            print(f"  ❌ Error: {e}")
            continue

    return False


# def create_fallback_flag(country_code: str, flags_dir: Path):
#     """Create a simple SVG flag as fallback"""
#     fallback_svg = f'''<?xml version="1.0" encoding="UTF-8"?>
# <svg width="160" height="107" viewBox="0 0 160 107" xmlns="http://www.w3.org/2000/svg">
#   <rect width="160" height="107" fill="#4a90e2" stroke="#ffffff" stroke-width="2"/>
#   <text x="80" y="60" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="24" font-weight="bold">{country_code}</text>
# </svg>'''
#
#     filename = flags_dir / f"{country_code.lower()}.svg"
#     with open(filename, 'w', encoding='utf-8') as f:
#         f.write(fallback_svg)
#
#     print(f"  🎨 Created fallback: {filename.name}")


def retry_failed_flags():
    """Retry downloading the flags that failed in the previous run"""
    print("🔄 Retrying failed flags with correct mappings...")

    failed_countries = ['BIH', 'CYP', 'LAT', 'LUX', 'NZL']
    flags_dir = Path("./images/flags")
    iso_mapping = get_iso_mapping()

    successful = 0

    for country_code in failed_countries:
        print(f"\n🏳️  Retrying: {country_code}")

        # Remove existing fallback SVG
        fallback_file = flags_dir / f"{country_code.lower()}.svg"
        if fallback_file.exists():
            fallback_file.unlink()
            print(f"  🗑️  Removed fallback: {fallback_file.name}")

        # Get correct ISO code
        iso_code = iso_mapping.get(country_code, country_code)
        print(f"  🔄 Mapping {country_code} → {iso_code}")

        if download_flag(country_code, iso_code, flags_dir):
            successful += 1
        else:
            print(f"  ❌ Still failed, no fallback")
            # print(f"  ❌ Still failed, keeping fallback")
            # create_fallback_flag(country_code, flags_dir)

    print(f"\n✅ Successfully downloaded {successful}/{len(failed_countries)} previously failed flags")


def main():
    print("🏁 Tennis Flag Downloader")
    print("=" * 50)

    # Load countries from player data
    countries = load_player_countries()
    if not countries:
        print("❌ No countries found. Exiting.")
        return

    # Create flags directory
    flags_dir = Path("./images/flags")
    flags_dir.mkdir(parents=True, exist_ok=True)
    print(f"📁 Saving flags to: {flags_dir.absolute()}")

    # Country code mapping
    iso_mapping = get_iso_mapping()

    # Download flags
    successful = 0
    failed = []

    print(f"\n🚀 Downloading {len(countries)} flags...")

    for i, country_code in enumerate(sorted(countries), 1):
        print(f"\n[{i:2d}/{len(countries)}] 🏳️  {country_code}")

        # Get ISO code
        iso_code = iso_mapping.get(country_code, country_code)
        if iso_code != country_code:
            print(f"  🔄 Mapping {country_code} → {iso_code}")

        if download_flag(country_code, iso_code, flags_dir):
            successful += 1
        else:
            print(f"  ⚠️  Creating fallback for {country_code}")
            create_fallback_flag(country_code, flags_dir)
            failed.append(country_code)

        # Be respectful to servers
        if i < len(countries):  # Don't sleep after last one
            time.sleep(0.8)

    # Summary
    print(f"\n📊 Download Summary:")
    print(f"   ✅ Successfully downloaded: {successful}")
    print(f"   🎨 Fallback SVGs created: {len(failed)}")
    print(f"   📁 Total flags ready: {len(countries)}")

    if failed:
        print(f"\n⚠️  Fallback flags created for: {', '.join(failed)}")
        print("   These will show country codes with colored backgrounds")

    # Show directory contents
    flag_files = list(flags_dir.glob("*"))
    print(f"\n📂 Created {len(flag_files)} flag files:")
    for f in sorted(flag_files)[:10]:  # Show first 10
        print(f"   {f.name}")
    if len(flag_files) > 10:
        print(f"   ... and {len(flag_files) - 10} more")

    print(f"\n🎾 Your tennis visualization is ready for flag images!")
    print(f"💡 Update your JavaScript to use: ./images/flags/{{country_code}}.png")

    # Offer to retry failed flags with correct mappings
    if failed:
        print(f"\n🔧 Run retry_failed_flags() to retry the failed flags with correct mappings")


if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1 and sys.argv[1] == "retry":
        retry_failed_flags()
    else:
        main()