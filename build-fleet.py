"""Rebuild the fleet catalogue from the pinned 4.10.3 game extraction.

Usage: python build-fleet.py --source-dir ../fleet-reference
Missing source files are downloaded from the pinned public data repository.
"""
import argparse
import json
from collections import Counter
from pathlib import Path
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parent
REVISION = 'f182b7f111279c9193df81927c9b4dbc8c4f3291'
RAW = f'https://raw.githubusercontent.com/StarCitizenWiki/scunpacked-data/{REVISION}/'
parser = argparse.ArgumentParser()
parser.add_argument('--source-dir', type=Path, default=ROOT.parent / 'fleet-reference')
CACHE = parser.parse_args().source_dir
CACHE.mkdir(parents=True, exist_ok=True)


def read(name):
    path = CACHE / name
    if not path.exists():
        with urlopen(RAW + name, timeout=60) as response:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(response.read())
    return json.loads(path.read_bytes())


items = read('ship-items.json')
ships = read('ships.json')
blueprints = read('blueprints.json')
index = {item['className'].lower(): item for item in items}
recipes = {b['Output']['Class'].lower(): b for b in blueprints
           if b['Kind'] == 'creation' and isinstance(b.get('Output'), dict)}
old = json.loads((ROOT / 'catalog.js').read_text().removeprefix('const ARGO_DATA = ').strip().removesuffix(';'))
parts = {}


def recipe_for(identifier):
    recipe = recipes.get(identifier)
    if not recipe:
        return None
    tier = recipe['Tiers'][0]
    ingredients = []
    for group in tier['Requirements'].get('Children', []):
        resources = group.get('Children', [])
        if len(resources) != 1:
            return None
        resource = resources[0]
        modifiers = []
        for modifier in group.get('Modifiers', []):
            segments = modifier.get('ValueSegments')
            if not segments:
                span, values = modifier['QualityRange'], modifier['ModifierRange']
                segments = [{'QualityMin': span['Min'], 'QualityMax': span['Max'],
                             'ModifierAtStart': values['AtMinQuality'], 'ModifierAtEnd': values['AtMaxQuality']}]
            additive = 'additive' in modifier.get('ValueRangeType', '')
            first, last = ('AdditiveAtStart', 'AdditiveAtEnd') if additive else ('ModifierAtStart', 'ModifierAtEnd')
            modifiers.append([modifier['Key'], additive,
                              [[s['QualityMin'], s['QualityMax'], s[first], s[last]] for s in segments]])
        ingredients.append({'part': group.get('Name', group.get('Key', 'Matériau')),
                            'material': resource['Name'],
                            'quantity': resource.get('QuantityScu', resource.get('Quantity', 0)),
                            'scu': 'QuantityScu' in resource, 'min': resource.get('MinQuality', 1),
                            'modifiers': modifiers})
    available = recipe.get('Availability', {})
    return {'id': recipe['Key'].lower(), 'seconds': tier['CraftTimeSeconds'], 'ingredients': ingredients,
            'unlock': 'default' if available.get('Default') else 'reward' if available.get('RewardPools') else 'unknown'}


def part(identifier):
    identifier = identifier.lower()
    if identifier in parts:
        return parts[identifier]
    item = index[identifier]
    original = item['stdItem']
    network = original.get('ResourceNetwork', {})
    state = next(iter(network.get('States', [])), {})
    signature = state.get('Signature', {})
    stats = {'hp': original.get('Durability', {}).get('Health', 0),
             'load': network.get('Usage', {}).get('Power', {}).get('Maximum', 0),
             'em': signature.get('EM', 0), 'ir': signature.get('IR', 0)}
    result = {'id': identifier, 'name': item.get('name') or identifier, 'size': item['size'], 'stats': stats}
    card = original.get('DescriptionData') or {}
    if card.get('Class'):
        result.update(kind=card['Class'], grade=card.get('Grade', ''))
    if 'Shield' in original:
        shield = original['Shield']
        stats.update(shield=shield['MaxShieldHealth'], regen=shield['MaxShieldRegen'],
                     down=shield['DownedDelay'], damageDelay=shield['DamagedDelay'])
    for resource, key in [('Power', 'output'), ('Coolant', 'cooling')]:
        if resource in network.get('Generation', {}):
            stats[key] = network['Generation'][resource]
    if 'QuantumDrive' in original:
        drive = original['QuantumDrive']
        jump = drive['StandardJump']
        stats.update(speed=jump['DriveSpeed'] / 1e6, burn=drive['QuantumFuelRequirement'],
                     spool=jump['SpoolUpTime'], cooldown=jump['CooldownTime'])
        result['accel'] = [jump['StageOneAccelRate'] / 1e6, jump['StageTwoAccelRate'] / 1e6, jump['EngageSpeed'] / 1e6]
    if 'Radar' in original:
        radar = original['Radar']
        stats.update(sensitivity=radar['Sensitivity']['RS'] * 100,
                     assistMin=radar['AimAssist']['DistanceMinAssignment'], assistMax=radar['AimAssist']['DistanceMaxAssignment'])
    if 'MiningLaser' in original:
        laser = original['MiningLaser']
        stats.update(beam=laser['PowerTransfer'], beamMin=laser['MinPowerTransfer'], optimal=laser['OptimalRange'],
                     distance=laser['MaximumRange'], extraction=laser['ExtractionThroughput'])
        result['slots'] = laser.get('ModuleSlots', 0)
        result['effects'] = {k: v for k, v in laser.get('Modifiers', {}).items() if k != 'AllChargeRates'}
    if item['type'] in ['WeaponGun', 'Missile']:
        weapon = original.get('Weapon', {})
        mode = next(iter(weapon.get('Modes', [])), {})
        stats.update(dps=mode.get('Dps', 0), alpha=mode.get('Alpha', 0), distance=weapon.get('EffectiveRange', 0))
    if item['type'] == 'Container':
        stats['cargo'] = original.get('ResourceContainer', {}).get('Capacity', {}).get('SCU', 0)
    if 'SalvageModifier' in original:
        salvage = original['SalvageModifier']
        stats.update(scrapeSpeed=salvage.get('SalvageSpeedMultiplier', 0),
                     scrapeRadius=salvage.get('RadiusMultiplier', 0),
                     scrapeEfficiency=100 * salvage.get('ExtractionEfficiency', 0))
    recipe = recipe_for(identifier)
    if recipe:
        result['recipe'] = recipe
    parts[identifier] = result
    return result


for module in old['parts']['module']:
    parts[module['id']] = {**module, 'recipe': recipe_for(module['id'])}
modules = [module['id'] for module in old['parts']['module']]
scrapers = [part(i['className'])['id'] for i in items
            if i['type'] == 'SalvageModifier' and 'SalvageModifier' in i['stdItem'] and 'scraper' in i['className'].lower()
            and i.get('name') not in [None, '', '<= PLACEHOLDER =>']
            and not any(marker in i['className'].lower() for marker in ['_test', '_template', '_debug'])]

GROUPS = {
    'QuantumDrive': ('drive', 'systems', 'Moteur quantique'),
    'PowerPlant': ('power', 'systems', 'Centrale électrique'),
    'Shield': ('shield', 'systems', 'Bouclier'),
    'Cooler': ('cooler', 'systems', 'Refroidisseur'),
    'Radar': ('radar', 'systems', 'Radar'),
    'JumpDrive': ('jump', 'systems', 'Module de saut'),
    'LifeSupportGenerator': ('lifesupport', 'systems', 'Support de vie'),
    'FlightController': ('flight', 'systems', 'Contrôleur de vol'),
    'WeaponGun': ('gun', 'guns', 'Arme'),
    'Missile': ('missile', 'guns', 'Missile'),
    'MissileLauncher': ('rack', 'guns', 'Lance-missiles'),
    'WeaponMining': ('laser', 'mining', 'Tête de minage'),
    'SalvageHead': ('salvage', 'salvage', 'Tête de salvage'),
    'SalvageModifier': ('scraper', 'salvage', 'Module de salvage'),
    'Container': ('pod', 'cargo', 'Pod de minerai'),
    'TractorBeam': ('tractor', 'salvage', 'Rayon tracteur'),
    'WeaponDefensive': ('defensive', 'guns', 'Contre-mesures'),
}


def walk(nodes):
    for port in nodes:
        yield port
        yield from walk(port.get('Loadout', []))


def choices(port, kind, slug):
    stock = port['ClassName'].lower()
    if not port.get('Editable') or kind in ['FlightController', 'MissileLauncher', 'WeaponDefensive', 'SalvageHead', 'TractorBeam']:
        return [stock]
    # Capital machinery is bespoke. Retain the Reclaimer's own S4 parts and their recipes.
    if port.get('MaxSize', 0) >= 4 and kind in ['Shield', 'PowerPlant', 'Cooler']:
        return [stock]
    if kind == 'Container':
        ids = ['cargo_shipmining_pod_golem', 'cargo_shipmining_pod_golem_btgl'] if slug == 'golem' else [
            'cargo_shipmining_pod_prospector', 'cargo_shipmining_pod_mole', 'cargo_shipmining_pod_moleprospector_btgl']
        return ids
    available = []
    tags = set(port.get('RequiredTags', []) + port.get('PortTags', []))
    for candidate in items:
        if candidate['type'] != kind or not port['MinSize'] <= candidate['size'] <= port['MaxSize']:
            continue
        if candidate.get('name') in [None, '', '<= PLACEHOLDER =>']:
            continue
        d = candidate['stdItem']
        if 'Tags' in d and 'flightReady' not in d['Tags'] and kind not in ['WeaponMining', 'LifeSupportGenerator', 'Missile']:
            continue
        if set(d.get('RequiredTags', [])) - tags:
            continue
        cid = candidate['className'].lower()
        if any(marker in cid for marker in ['_test', '_template', '_debug', '_npc']):
            continue
        if kind == 'WeaponMining':
            if not cid.startswith(('mining_laser_grin_', 'mining_laser_thcn_', 'mining_laser_shin_')) and cid != stock:
                continue
            if 'miningMount' not in d.get('Tags', []):
                continue
        available.append(cid)
    return sorted(set([stock] + available), key=lambda cid: index[cid].get('name', cid).lower())


SPECS = [
    ('prospector', 'MISC_Prospector', 'MISC Prospector', 'Minage solo', 'https://robertsspaceindustries.com/en/comm-link/transmission/18553-Alpha-317-Has-Launched'),
    ('golem', 'DRAK_Golem', 'Drake Golem', 'Minage solo', 'https://robertsspaceindustries.com/pledge/ships/golem/Golem'),
    ('vulture', 'DRAK_Vulture', 'Drake Vulture', 'Salvage solo', 'https://robertsspaceindustries.com/pledge/ships/drake-vulture/Vulture'),
    ('fortune', 'MISC_Fortune', 'MISC Fortune', 'Salvage solo', 'https://robertsspaceindustries.com/pledge/ships/fortune/Fortune'),
    ('salvation', 'RSI_Salvation', 'RSI Salvation', 'Salvage solo', 'https://robertsspaceindustries.com/pledge/ships/salvation/Salvation'),
    ('moth', 'ARGO_MOTH', 'ARGO MOTH', 'Salvage en équipage', 'https://robertsspaceindustries.com/pledge/ships/moth/MOTH'),
    ('reclaimer', 'AEGS_Reclaimer', 'Aegis Reclaimer', 'Salvage lourd en équipage', 'https://robertsspaceindustries.com/en/pledge/ships/reclaimer/Reclaimer'),
]
fleet = []
for slug, class_name, name, role, image_source in SPECS:
    source = next(s for s in ships if s['ClassName'] == class_name)
    counts = Counter()
    slots = []
    paths = {}
    for port in walk(source['Loadout']):
        kind = port.get('Type', '').split('.')[0]
        cid = port.get('ClassName', '').lower()
        if kind not in GROUPS or cid not in index:
            continue
        if kind == 'Container' and ('collapsed' in cid or 'stored_pod' in port['HardpointName']):
            continue
        group, category, label = GROUPS[kind]
        number = counts[group]
        counts[group] += 1
        key = group + str(number)
        ids = choices(port, kind, slug)
        for identifier in ids:
            part(identifier)
        slot = {'id': key, 'group': group, 'category': category, 'label': label + ' ' + str(number + 1),
                'stock': cid, 'choices': ids, 'size': index[cid]['size'],
                'editable': bool(port.get('Editable')), 'path': '/'.join(port.get('Path', []))}
        if group == 'scraper':
            slot['parent'] = paths.get(port.get('ParentPortId'))
        slots.append(slot)
        paths[port.get('PortId')] = key
        if group == 'laser':
            for i in range(3):
                slots.append({'id': f'module{number}-{i}', 'group': 'module', 'category': 'mining',
                              'label': f'Module {i + 1} · tête {number + 1}', 'stock': None,
                              'choices': modules, 'size': 1, 'editable': True, 'parent': key, 'moduleIndex': i})
    buffer = 0
    structural = []
    for port in walk(source['Loadout']):
        kind = port.get('Type', '').split('.')[0]
        cid = port.get('ClassName', '').lower()
        local = CACHE / (cid + '.json')
        if kind in ['SalvageController', 'SalvageInternalStorage']:
            data = json.loads(local.read_bytes()) if local.exists() else read('items/' + cid + '.json')
            raw = data.get('Raw', {}).get('Entity', {}).get('Components', {})
            if kind == 'SalvageInternalStorage':
                buffer += raw.get('ResourceContainer', {}).get('capacity', {}).get('SStandardCargoUnit', {}).get('standardCargoUnits', 0)
            else:
                controller = raw.get('SCItemSalvageControllerParams', {})
                params = controller.get('structuralParams', {}).get('SSalvageStructuralParams', {})
                if params:
                    structural.append({'fracture': params.get('maxFracturableRadius'), 'disintegration': params.get('maxDisintegratableRadius')})
    stock = {s['id']: s['stock'] for s in slots}
    balanced = dict(stock)
    for slot in slots:
        if not slot['editable']:
            continue
        group = slot['group']
        target = None
        if group == 'drive':
            target = {1: 'Goliath', 2: 'Huracan', 3: 'Kama'}.get(slot['size'])
        elif group == 'shield':
            target = {1: 'FR-66', 2: 'FR-76', 3: "5CA 'Akura'"}.get(slot['size'])
        elif group == 'power':
            target = {1: 'JS-300', 2: 'JS-400', 3: 'Durango'}.get(slot['size'])
        elif group == 'cooler':
            target = {1: 'Ultra-Flow', 2: 'Avalanche', 3: 'Chill-Max'}.get(slot['size'])
        elif group == 'laser' and slug != 'golem':
            target = 'Helix I Mining Laser'
        if target:
            replacement = next((cid for cid in slot['choices'] if parts[cid]['name'] == target), None)
            if replacement:
                balanced[slot['id']] = replacement
    for slot in slots:
        if slot['group'] == 'module':
            head = parts[balanced[slot['parent']]]
            desired = ['mining_modules_passive_focus_mk3', 'mining_modules_passive_deluge']
            if slot['moduleIndex'] < min(head['slots'], 2):
                balanced[slot['id']] = desired[slot['moduleIndex']]
    notes = []
    if slug == 'golem':
        notes = ['Deux pods Drake de 16 SCU. Les pods GOLEM MC-4 fabriqués portent le total à 40 SCU. Les pods du MOLE et du Prospector ne conviennent pas à ces attaches.',
                 'Le Pitman reste la tête recommandée d’origine ; les autres têtes S1 proposées correspondent au montage des données 4.10.3.']
    if slug == 'prospector':
        notes = ['Quatre pods actifs : 32 SCU d’origine, 48 SCU avec les pods du MOLE, 60 SCU avec les MISC Enhanced. Les quatre sacs de rechange repliés ne sont pas comptés dans la capacité active.']
    if slug == 'reclaimer':
        notes = ['Centrale S4 intégrée. Bouclier RS-Barrier et refroidisseur Algid dédiés : leur blueprint peut être comparé sans proposer de pièces d’autres capitaux.',
                 'Les sept PDC sont intégrés. Les armes S3 des tourelles et les deux canons S5 sont distingués.']
    if buffer:
        notes += ['La soute cargo et le tampon interne de salvage sont séparés. Les modules marqués intégrés restent ceux du montage d’origine ; leur blueprint est consultable pour comparaison.']
    fleet.append({'id': slug, 'className': class_name, 'name': name, 'role': role, 'crew': source.get('Crew'),
                  'fuel': source['QuantumTravel']['FuelCapacity'] / 1000, 'cargo': source.get('Cargo', 0),
                  'ore': source.get('OreCapacity', 0), 'buffer': buffer, 'structural': structural,
                  'scm': source['FlightCharacteristics']['Speeds']['Scm'], 'nav': source['FlightCharacteristics']['Speeds']['Max'],
                  'hull': source['Health'], 'image': 'fleet-' + slug + '.webp', 'imageSource': image_source,
                  'slots': slots, 'stock': stock, 'balanced': balanced, 'notes': notes,
                  'source': f'https://github.com/StarCitizenWiki/scunpacked-data/blob/{REVISION}/ships/{class_name.lower()}.json'})
data = {'patch': '4.10.3', 'revision': REVISION, 'ships': fleet, 'parts': parts, 'scrapers': scrapers,
        'points': old['points'], 'gates': old['gates']}
(ROOT / 'fleet-data.js').write_text('const FLEET_DATA = ' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n')
for ship in fleet:
    print(ship['name'], len(ship['slots']), 'emplacements', 'soute', ship['cargo'], 'tampon', ship['buffer'])
print(len(parts), 'références,', sum(bool(p.get('recipe')) for p in parts.values()), 'blueprints')
