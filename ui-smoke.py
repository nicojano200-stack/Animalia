"""Real Chromium smoke checks, run against local server or published Pages URL."""
import sys, time
from playwright.sync_api import sync_playwright, expect
url=sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:8765/'
def enter_farm(page):
    page.goto(url,wait_until='domcontentloaded',timeout=60000)
    expect(page.locator('#loading')).to_be_hidden(timeout=20000)
    page.locator('#levelToggle').click()
    page.locator('#levelChoices button').filter(has_text='Tutorial 04').click()
    expect(page.locator('#economyBar')).to_be_visible(timeout=15000)
def no_overlap(a,b):
    return a['x']+a['width']<=b['x']+2 or b['x']+b['width']<=a['x']+2 or a['y']+a['height']<=b['y']+2 or b['y']+b['height']<=a['y']+2
with sync_playwright() as pw:
    browser=pw.chromium.launch(headless=True,args=['--no-sandbox'])
    for width,height in [(1440,900),(390,844),(320,700)]:
        page=browser.new_page(viewport={'width':width,'height':height})
        errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        enter_farm(page)
        expect(page.locator('#shopGuide')).to_be_visible()
        page.locator('#shopToggle').click()
        expect(page.locator('#shopPanel')).to_be_visible()
        for _ in range(5):
            page.locator('[data-buy=seed]').click()
        expect(page.locator('[data-buy=seed]')).to_be_disabled()
        page.locator('#inventoryToggle').click()
        expect(page.locator('#inventoryPanel')).to_be_visible()
        expect(page.locator('#inventorySlots .inventory-slot')).to_have_count(20)
        expect(page.locator('[data-slot="seed:0"]')).to_contain_text('5')
        if width>=1050:
            expect(page.locator('#shopPanel')).to_be_visible()
            assert no_overlap(page.locator('#shopPanel').bounding_box(),page.locator('#inventoryPanel').bounding_box()),'desktop panels overlap'
        else:
            expect(page.locator('#shopPanel')).to_be_hidden()
        page.locator('[data-slot="seed:0"]').click()
        page.locator('[data-action=equipSeed]').click()
        page.locator('[data-action=useSeed]').click()
        expect(page.locator('#gardenPanel')).to_be_visible()
        for i in range(5):
            page.locator(f'[data-plot="{i}"]').click()
            expect(page.locator('#inventoryPanel')).to_be_visible()
            expect(page.locator('#seedPickerHint')).to_contain_text(f'Plot {i+1}')
            page.locator('[data-slot="seed:0"]').click()
            page.locator('[data-action=plantEquipped]').click()
            expect(page.locator('#gardenPanel')).to_be_visible()
        expect(page.locator('#gardenInventory')).to_contain_text('0 seeds')
        expect(page.locator('[data-skip]')).to_have_count(5)
        page.locator('[data-skip="0"]').click()
        expect(page.locator('[data-skip]')).to_have_count(4)
        # Reload preserves the crop and its free-skip eligibility.
        enter_farm(page)
        page.locator('#gardenToggle').click()
        for i in range(1,5):
            page.locator(f'[data-skip="{i}"]').click()
        for i in range(5):
            page.locator(f'[data-plot="{i}"]').click()
        page.locator('#inventoryToggle').click()
        page.locator('[data-slot="carrot:0"]').click()
        for _ in range(5):
            page.locator('[data-action=sell]').click()
        expect(page.locator('#coinBalance')).to_have_text('50')
        page.locator('#shopToggle').click()
        page.locator('[data-category=cosmetics]').click()
        page.locator('[data-buy=item][data-item=shirt]').click()
        expect(page.locator('#coinBalance')).to_have_text('30')
        page.keyboard.press('Escape')
        page.locator('#inventoryToggle').click()
        page.locator('[data-filter=cosmetics]').click()
        page.locator('[data-slot="shirt:0"]').click()
        page.locator('[data-action=item]').click()
        page.keyboard.press('Escape')
        expect(page.locator('#inventoryPanel')).to_be_hidden()
        assert no_overlap(page.locator('.brand').bounding_box(),page.locator('.round').bounding_box()),'brand/round overlap'
        assert no_overlap(page.locator('.quest').bounding_box(),page.locator('#economyBar').bounding_box()),'quest/economy overlap'
        assert not errors,errors
        print(f'PASS {width}x{height}: shop, 20 slots, planting, saved crop timers, sale, cosmetic equip and HUD')
        page.close()
    browser.close()
