from playwright.sync_api import sync_playwright
import json, time, base64, math, urllib.parse, sys
def b64(o): return base64.urlsafe_b64encode(json.dumps(o).encode()).decode().rstrip('=')
now=int(time.time())
JWT=b64({'alg':'none','typ':'JWT'})+'.'+b64({'sub':'uid1','user_id':'uid1','email':'t@example.com','email_verified':True,'iat':now,'exp':now+3600,'aud':'chart-reader-45c13','iss':'https://securetoken.google.com/chart-reader-45c13','auth_time':now,'firebase':{'sign_in_provider':'password','identities':{}}})+'.x'
CORS={'access-control-allow-origin':'*','access-control-allow-headers':'authorization, content-type, ngrok-skip-browser-warning, x-firebase-gmpid, x-client-version','access-control-allow-methods':'GET, POST, OPTIONS'}
LIC={'token':'tok','admin':False,'status':'paid','entitled':True,'trialEnd':(now+86400*30)*1000,'paidUntil':(now+86400*30)*1000}
def yahoo():
    t0=now-3600*24; ts=[t0+i*900 for i in range(300)]; c=[1.08+0.004*math.sin(i/12)+0.0006*math.sin(i*1.7) for i in range(300)]
    return {'chart':{'result':[{'timestamp':ts,'indicators':{'quote':[{'open':[x-0.0002 for x in c],'high':[x+0.0006 for x in c],'low':[x-0.0006 for x in c],'close':c,'volume':[1000+i for i in range(300)]}]}}]}}
seen={'proxy':[], 'post':[], 'dialogs':[]}
def handler(route):
    req=route.request; u=req.url
    if u.startswith('http://localhost:8099'): return route.continue_()
    if req.method=='OPTIONS': return route.fulfill(status=204, headers=CORS)
    def js(o,code=200): route.fulfill(status=code, headers={**CORS,'content-type':'application/json'}, body=json.dumps(o))
    if 'identitytoolkit' in u:
        if 'signInWithPassword' in u or 'signUp' in u: return js({'idToken':JWT,'refreshToken':'r','expiresIn':'3600','localId':'uid1','email':'t@example.com'})
        if 'lookup' in u: return js({'users':[{'localId':'uid1','email':'t@example.com','emailVerified':True,'displayName':'Test','providerUserInfo':[{'providerId':'password'}],'createdAt':'1','lastLoginAt':'1'}]})
        return js({})
    if 'securetoken' in u: return js({'id_token':JWT,'refresh_token':'r','expires_in':'3600','user_id':'uid1'})
    if 'ngrok' in u:
        path=urllib.parse.urlparse(u).path
        if path=='/proxy':
            target=urllib.parse.parse_qs(urllib.parse.urlparse(u).query)['u'][0]; seen['proxy'].append((target[:70], req.headers.get('ngrok-skip-browser-warning'), req.headers.get('user-agent','')[:20]))
            if 'yahoo' in target: return js(yahoo())
            if 'faireconomy' in target: return js([])
            if 'alternative.me' in target: return js({'data':[{'value':'50','value_classification':'Neutral'}]})
            return route.fulfill(status=200, headers={**CORS,'content-type':'application/xml'}, body='<rss><channel></channel></rss>')
        seen['post'].append(path)
        if path in('/register','/status','/pay'): return js(LIC)
        if path=='/sync/get': return js({'data':None,'updatedAt':0,'profile':{'name':'Test','phone':''}})
        return js({'ok':True})
    return route.abort()

# ---- the test: log in on the website (Firebase + server are faked) and check the parts that differ from the phone ----
# Run:  npx expo export --platform web && (cd dist && python3 -m http.server 8099) &   then   python3 tests/web/smoke.py
fails=0
def ok(c,m):
    global fails
    if not c: fails+=1
    print(('ok   ' if c else 'FAIL ')+m)
if __name__=='__main__':
    with sync_playwright() as p:
        b=p.chromium.launch(); ctx=b.new_context(viewport={'width':1280,'height':900}); pg=ctx.new_page(); errs=[]
        pg.on('pageerror', lambda e: errs.append(str(e)[:200])); pg.on('dialog', lambda d: (seen['dialogs'].append(d.type), d.dismiss()))
        pg.route('**/*', handler); pg.goto('http://localhost:8099/'); pg.wait_for_timeout(4800)
        col=pg.evaluate("(()=>{const e=[...document.querySelectorAll('div')].find(x=>getComputedStyle(x).maxWidth==='520px');if(!e)return [0,99999];const r=e.getBoundingClientRect();return [Math.round(r.left),Math.round(r.width)]})()")
        ok(col[1]<=520 and col[0]>300, f'app sits in a centred column (x={col[0]}, width={col[1]})')
        pg.get_by_text('Log in', exact=True).first.click(); pg.wait_for_timeout(500)
        bx=pg.get_by_role('textbox'); bx.nth(0).fill('t@example.com'); bx.nth(1).fill('secret12'); pg.get_by_text('Log in', exact=True).last.click(); pg.wait_for_timeout(3500)
        ok(pg.get_by_text('Hello, Test').count()==1, 'login works (Firebase sign-in, licence, sync)')
        ok(set(['sec_account','sec_lic','sec_remember','sec_device_id'])<=set(pg.evaluate("Object.keys(localStorage)")), 'login data is kept in the browser (secure store replacement)')
        ok('/register' in seen['post'] and '/sync/get' in seen['post'], 'server calls work from the browser (CORS headers accepted)')
        ok(any('faireconomy' in x[0] and x[1]=='1' for x in seen['proxy']), 'news calendar goes through the server proxy')
        pg.get_by_text('Settings', exact=True).last.click(); pg.wait_for_timeout(700); pg.get_by_text('Edit profile', exact=True).first.click(); pg.wait_for_timeout(800)
        r=pg.evaluate("(()=>{const d=[...document.querySelectorAll('*')].find(e=>getComputedStyle(e).zIndex==='1000');if(!d)return null;const b=d.getBoundingClientRect();return [Math.round(b.left),Math.round(b.width)]})()")
        ok(r is not None and r[1]<=520, f'pop-up opens inside the column ({r})')
        pg.mouse.move(640,500); pg.mouse.wheel(0,2500); pg.get_by_text('Delete account', exact=True).click(); pg.wait_for_timeout(400); pg.mouse.wheel(0,2500)
        pg.get_by_placeholder('Your password').last.fill('secret12'); pg.get_by_text('Delete my account', exact=True).click(); pg.wait_for_timeout(500)
        ok('confirm' in seen['dialogs'], 'confirm question shows as a browser confirm box')
        pg.keyboard.press('Escape'); pg.wait_for_timeout(400)
        ok(not pg.evaluate("[...document.querySelectorAll('*')].some(e=>getComputedStyle(e).zIndex==='1000')"), 'Escape closes the pop-up')
        pg.get_by_text('Analysis', exact=True).last.click(); pg.wait_for_timeout(900); pg.get_by_text('ICT Analysis', exact=True).first.click(); pg.wait_for_timeout(14000)
        ok(any('yahoo' in x[0] for x in seen['proxy']), 'backup prices (Yahoo) come through the server proxy')
        n0=pg.evaluate("document.querySelectorAll('svg rect').length"); pg.mouse.move(600,700)
        for _ in range(6): pg.mouse.wheel(0,-300); pg.wait_for_timeout(100)
        pg.wait_for_timeout(400); n1=pg.evaluate("document.querySelectorAll('svg rect').length")
        ok(n1<n0, f'mouse wheel zooms the chart ({n0} -> {n1} shapes)')
        ok(not errs, f'no page errors {errs[:2]}')
        b.close()
    print('FAILED' if fails else 'all web tests pass'); raise SystemExit(1 if fails else 0)
