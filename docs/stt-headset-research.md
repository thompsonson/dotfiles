# Headset/Microphone Research for Speech-to-Text Dictation

Research into earphone/microphone configurations suitable for speech-to-text dictation workflows on computers and phones. Focus on open-ear/bone conduction form factors that allow environmental awareness while providing good microphone quality for Whisper-based transcription.

Platforms: macOS, Linux, and Android.

---

## Quick Recommendation Summary

| Priority | Best Pick | Price | Why |
|----------|-----------|-------|-----|
| **Best mic for STT** | Shokz OpenComm2 UC (2025) | ~$200 | Boom mic + noise cancellation, 16h talk time, USB dongle for PC |
| **Best sound + decent mic** | Shokz OpenMeet UC | ~$250 | Best-sounding bone conduction, dual mic with cVc, overhead design |
| **Most discreet** | Shokz OpenFit 2+ | ~$200 | TWS earbuds, AI-enhanced mics, not bone conduction but open-ear |
| **Best for Linux** | OpenComm2 (Bluetooth, no dongle) + laptop mic split | ~$160 | USB dongle broken on Linux; use BT A2DP output + laptop mic for input |
| **Purpose-built for dictation** | Philips SpeechOne | ~$450-750 | Lossless 2.4GHz wireless, studio-quality mic, designed for medical dictation |
| **Budget open-ear w/ boom mic** | EMEET AirFlow | ~$80 | Open-ear TWS with detachable boom mic and USB dongle |

**The uncomfortable truth**: On Linux, any Bluetooth headset microphone will be low quality due to the HFP codec limitation. The best Linux workflow is to use the headset for audio output (A2DP) and a separate wired/USB mic or laptop built-in mic for speech input.

---

## The Bluetooth Microphone Problem

This is the single most important thing to understand before buying any Bluetooth headset for speech-to-text work.

### How Bluetooth Audio Profiles Work

Bluetooth audio has two mutually exclusive modes:

| Profile | Direction | Quality | Use |
|---------|-----------|---------|-----|
| **A2DP** (Advanced Audio Distribution) | One-way (output only) | High quality stereo (SBC, AAC, aptX, LDAC) | Music, podcasts, TTS playback |
| **HFP/HSP** (Hands-Free / Headset Profile) | Bidirectional (mic + output) | Mono, narrow/wideband speech only | Phone calls, mic input |

When you activate the microphone on a Bluetooth headset, the system **must** switch from A2DP to HFP. This drops audio quality dramatically -- from high-fidelity stereo to mono telephony-grade audio. This is not a bug; it is a fundamental limitation of the Bluetooth specification.

### HFP Codec Options

Within HFP, there are two codec choices:

- **CVSD**: Narrow-band (8 kHz), mandatory codec. Sounds like a landline phone from the 1990s.
- **mSBC**: Wide-band (16 kHz), optional. Better than CVSD but still far below A2DP quality.

### Impact on Whisper / Speech Recognition

Whisper resamples all audio to 16 kHz before processing, so sample rate alone is not the bottleneck. However, the HFP codecs introduce compression artifacts, noise, and reduced frequency range that degrade transcription accuracy:

- Whisper tolerates moderate quality reduction (tested across 16-128 kbps with similar accuracy)
- Whisper struggles with **noise, distortion, and poor signal quality** -- exactly what HFP introduces
- In practice: "if you can understand it clearly, Whisper probably can too" -- but HFP audio is borderline
- Poor-quality audio causes Whisper to produce repetitive hallucinations or miss words entirely

### The Linux Situation is Worse

On Linux, HFP microphone support has historically been problematic:

- PulseAudio had limited HFP support; PipeWire is better but still has issues
- mSBC (wideband) must be explicitly enabled via WirePlumber config (`bluez5.enable-msbc = true`)
- Even with mSBC enabled, users report "horrible quality," crackling, and "extremely bad audio input"
- Some headsets work fine; others produce audio that sounds like "standing next to an airplane engine"
- The experience varies significantly between Bluetooth chipsets, kernel versions, and PipeWire versions

To enable mSBC on PipeWire/WirePlumber, create `~/.config/wireplumber/wireplumber.conf.d/bluez-config.conf`:

```ini
monitor.bluez.properties = {
  bluez5.enable-msbc = true
}
```

### The Practical Workaround: Split Input/Output

The best approach for Linux STT work is to **never use the Bluetooth headset microphone**:

1. Keep Bluetooth headset in **A2DP mode** (high-quality audio output for TTS playback)
2. Use your **laptop's built-in microphone** or a **USB microphone** for speech input
3. Configure your STT tool to use the USB/built-in mic as input device

This gives you the best of both worlds: open-ear audio output through bone conduction, plus high-quality mic input for accurate Whisper transcription.

### Future: Bluetooth LE Audio (LC3)

Bluetooth LE Audio with the LC3 codec solves this problem by supporting simultaneous high-quality stereo output and microphone input. However:

- PipeWire has experimental LC3 support since version 0.3.59, but it is **disabled by default**
- Requires Linux kernel 6.4+, latest BlueZ, PipeWire compiled with liblc3, and a Bluetooth 5.2+ adapter
- Full SIG-qualified support in Linux is targeted for **2026**
- Very few headsets currently support LE Audio bidirectional profiles
- Not a practical solution today, but the correct long-term fix

Sources:
- [LE Audio support in PipeWire (BlueZ)](https://www.bluez.org/le-audio-support-in-pipewire/)
- [PipeWire Bluetooth support status (Collabora)](https://www.collabora.com/news-and-blog/news-and-events/pipewire-bluetooth-support-status-update.html)
- [Implementing LE Audio on Linux (Collabora, 2025)](https://www.collabora.com/news-and-blog/blog/2025/11/24/implementing-bluetooth-le-audio-and-auracast-on-linux-systems/)
- [ArchWiki: Bluetooth headset](https://wiki.archlinux.org/title/Bluetooth_headset)
- [ArchWiki: PipeWire](https://wiki.archlinux.org/title/PipeWire)
- [WirePlumber Bluetooth configuration](https://pipewire.pages.freedesktop.org/wireplumber/daemon/configuration/bluetooth.html)

---

## Shokz Product Lineup

### Shokz OpenComm2 (2025 Upgrade) -- BEST MIC FOR STT

The communication-focused model with a dedicated boom microphone. This is the strongest candidate for speech-to-text dictation in the Shokz lineup.

- **Price**: ~$160 (without dongle), ~$200 (UC version with USB dongle)
- **Mic type**: Adjustable boom mic with noise-canceling DSP and dual noise cancellation
- **Mic quality**: Best in the Shokz lineup. Clear voice capture, filters ambient noise. Praised for call clarity by multiple reviewers.
- **Audio tech**: 7th generation bone conduction, PremiumPitch 2.0
- **Battery**: 16h talk time, 8h listening. 5-min quick charge = 2h talk. Full charge in ~1 hour.
- **Weight**: 35g
- **Water resistance**: IP55
- **Bluetooth**: 5.2, multipoint (2 devices)
- **Charging**: USB-C (2025 upgrade)
- **Mute button**: Yes (physical, on boom arm)
- **Comfort**: Ultra-lightweight, wraps behind neck. Most users report forgetting they are wearing it. Some fit issues for very small or very large heads (no size adjustment). Mixed reports with glasses.
- **Conspicuousness**: Visible boom mic. Looks professional in an office, somewhat conspicuous in public.

**UC version (with USB dongle)**: Includes Shokz Loop120 wireless adapter (USB-A or USB-C). The dongle provides a more stable connection than native Bluetooth and handles audio profile switching automatically. Zoom-certified.

**STT-specific feedback** (from KnowBrainer dictation forums):
- Positive: Some users report it works better than Sennheiser Presence UC for Dragon NaturallySpeaking (no lost first words, better number formatting, longer session stability)
- Negative: Others find it "consistently less accurate than the Sennheiser MB Pro 1" and note it picks up voices of people approaching from the right side
- Connectivity: Occasional Bluetooth drops reported; toggling the mic off/on usually resolves it

Sources:
- [Shokz OpenComm2 UC 2025 (official)](https://shokz.com/products/opencomm2uc-2025-upgrade)
- [SoundGuys OpenComm2 UC review](https://www.soundguys.com/shokz-opencomm2-uc-review-103856/)
- [KnowBrainer forum: Shokz mic experiences](https://forums.knowbrainer.com/forum/microphones-and-sound-cards/103-disappointment-with-schokz-mic)
- [Best Buy: OpenComm 2 reviews](https://www.bestbuy.com/site/reviews/shokz-opencomm-2-bluetooth-bone-conduction-headset-black/6561016)

---

### Shokz OpenMeet UC -- BEST SOUND + STRONG MIC

The newest Shokz model (CES 2025), with an over-the-head design instead of the wrap-around band.

- **Price**: ~$250 (UC), ~$220 (without dongle)
- **Mic type**: Dual boom mic with Qualcomm cVc (Clear Voice Capture) noise reduction
- **Mic quality**: Excellent. Cuts 98.6% of background noise per Shokz. SoundGuys found the mic "highly capable in quiet and noisy environments." Multiple reviewers report crystal-clear voice on calls.
- **Audio tech**: 10th generation bone conduction with DualPitch Technology (bone + air conduction hybrid)
- **Battery**: 15h listening, 14h talk. 5-min quick charge = 2h playback. 90 min full charge.
- **Weight**: 78g (lightest overhead wireless office headset)
- **Water resistance**: IP55
- **Bluetooth**: 5.4, multipoint (2 devices, remembers 8)
- **Charging**: USB-C
- **Mute button**: Yes (dedicated, on boom arm) with LED indicator
- **Comfort**: Over-the-head design accommodates glasses via TitaniumFlex. Interchangeable temple cushions in 3 sizes. Very comfortable for hours. Caveat: SoundGuys noted it slides when looking down.
- **Conspicuousness**: Over-the-head design is more conspicuous than wrap-around models. Office-appropriate. Not ideal for wearing in public.
- **Includes**: Loop 120 USB dongle (UC version), Zoom-certified

**Best for**: Desk-bound dictation work where sound quality matters and you do not need to wear it outside the office.

Sources:
- [SoundGuys OpenMeet UC review](https://www.soundguys.com/shokz-openmeet-uc-review-130252/)
- [AVNetwork OpenMeet UC review](https://www.avnetwork.com/news/ces-2025-product-review-shokz-presents-new-twist-on-office-headset-january-7-at-8-a-m-et)
- [Digital Reviews Network OpenMeet UC](https://www.digitalreviews.net/reviews/audio/shokz-openmeet-uc-the-office-headset-you-didnt-know-you-needed/)
- [Shokz OpenMeet UC (official)](https://pro.shokz.com/products/openmeet-uc)

---

### Shokz OpenFit 2 / OpenFit 2+ -- MOST DISCREET

True wireless open-ear earbuds. NOT bone conduction -- uses DirectPitch air conduction. The most discreet option for wearing in public.

- **Price**: $180 (OpenFit 2), $200 (OpenFit 2+)
- **Mic type**: Built-in, 2 mics per earbud (4 total) with AI noise cancellation
- **Mic quality**: One of the best in the open-ear earbud category. Reviewers report clear voice even while cycling at 25 km/h. AI processing handles office chatter and street noise well. Struggles in wind.
- **Audio tech**: DualBoost Technology, dual drivers per earbud (17.3mm bass + high-frequency)
- **Battery**: 11h per charge, 48h with case. 10-min quick charge = 2h playback.
- **Weight**: 9.4g per earbud
- **Water resistance**: IP55
- **Bluetooth**: 5.4
- **Charging**: USB-C (2+: adds wireless charging)
- **EQ**: 4 customizable modes via Shokz App
- **Comfort**: Ultra-soft silicone 2.0 ear hooks, nickel-titanium alloy. Very comfortable for extended wear.
- **Conspicuousness**: Very discreet. Small TWS earbuds in black or beige. Best option for wearing in public without drawing attention.

**OpenFit 2+ additions**: Dolby Audio, AI-enhanced call quality (4 mics), DirectPitch 2.0 (less sound leakage), wireless charging.

**Limitation for STT**: No boom mic means the mic is further from your mouth. Works well in quiet environments but less ideal than boom-mic models for noisy settings. Still subject to the Bluetooth HFP quality limitation when used as a mic input on desktop.

Sources:
- [SoundGuys OpenFit 2 review](https://www.soundguys.com/shokz-openfit-2-review-iteration-done-right-133776/)
- [SoundGuys OpenFit 2+ review](https://www.soundguys.com/shokz-openfit-2-review-worth-the-20-upgrade-150051/)
- [TechRadar OpenFit 2 review](https://www.techradar.com/health-fitness/fitness-headphones/shokz-openfit-2-review)
- [Shokz OpenFit 2 (official)](https://shokz.com/products/openfit2)

---

### Shokz OpenRun Pro 2 -- FITNESS FOCUS, WEAK MIC

The flagship fitness model. Good sound, poor microphone.

- **Price**: ~$180 (list), ~$140 (sale)
- **Mic type**: Dual built-in mics (no boom), AI noise reduction
- **Mic quality**: Sub-par for calls. "Microphone quality won't blow you away" (SoundGuys). Adequate in quiet environments, poor in wind. Not recommended for dictation.
- **Audio tech**: DualPitch Technology (bone + air conduction)
- **Battery**: 12h
- **Weight**: 31g
- **Water resistance**: IP55
- **Bluetooth**: 5.3
- **Comfort**: Excellent for sports. Wrap-around design stays secure.

**Verdict for STT**: Not recommended. The mic is designed for occasional phone calls during exercise, not sustained dictation work.

Sources:
- [SoundGuys OpenRun Pro 2 review](https://www.soundguys.com/shokz-openrun-pro-2-review-127935/)
- [Tom's Guide OpenRun Pro 2 review](https://www.tomsguide.com/wellness/fitness/shokz-openrun-pro-2-review)

---

## Shokz USB Dongle on Linux -- CRITICAL ISSUE

The Shokz Loop110 and Loop120 USB dongles have **known, unresolved compatibility issues on Linux**.

### Confirmed Problems

| Component | Status |
|-----------|--------|
| Audio output via USB dongle | Partially working -- crackling, dropouts, fades |
| Microphone via USB dongle | **Broken** -- capture device not shown, or PipeWire errors |
| Audio output via direct Bluetooth (A2DP) | Works |
| Microphone via direct Bluetooth (HFP) | Works (with HFP quality limitations) |
| Shokz Connect firmware updates | No Linux version |

### Technical Details

The Loop110 identifies as `idVendor=3511, idProduct=2b0a` (Qualcomm chipset) behind a USB hub (`idVendor=0a12, idProduct=4010`). PipeWire logs show `spa.alsa: set_hw_params: Broken pipe` errors when attempting to use the capture device. The ALSA driver does not properly handle the dongle's audio descriptor configuration.

Tracked bugs:
- [Ubuntu Bug #2048897](https://bugs.launchpad.net/bugs/2048897) -- Input and Duplex profiles missing
- [Arch Linux Forum Thread](https://bbs.archlinux.org/viewtopic.php?id=289616) -- USB headset not showing mic

### Workaround

Use direct Bluetooth pairing (bypass the USB dongle entirely). This works reliably on Linux for both A2DP output and HFP microphone input. You lose the dongle's improved connection handling, but the headset functions normally.

### Implication for Purchasing

**Do not buy the UC (dongle) version specifically for Linux.** Buy the standard Bluetooth-only OpenComm2 ($160) instead. The $40 premium for the UC dongle buys you nothing on Linux. On macOS or Windows, the UC version is worth it.

---

## Non-Shokz Alternatives

### EMEET AirFlow -- BUDGET OPEN-EAR WITH BOOM MIC

True wireless open-ear earbuds with a **detachable boom microphone** and a USB dongle. A unique product in the market.

- **Price**: ~$80
- **Mic type**: 2 built-in omnidirectional mics + detachable boom mic
- **Mic quality**: VoiceCore dual-channel noise cancellation, rated to filter 50 dB of unwanted noise. Having the boom mic close to mouth significantly improves call clarity.
- **Battery**: 20h talk time, 40h playback. 5-min quick charge = 1h use.
- **Weight**: 8.5g per earbud
- **Water resistance**: IPX5
- **Bluetooth**: 5.3
- **USB dongle**: Yes -- USB-A dongle included, with LED mute indicator
- **Comfort**: Very lightweight, skin-friendly coating. Open-ear design.
- **Conspicuousness**: Small earbuds, but the detachable boom mic is visible when attached.

**Zoom Edition** available with Zoom certification and spatial audio.

**For STT**: The combination of a detachable boom mic + USB dongle is interesting. The USB dongle may or may not work on Linux (untested in the search results). The boom mic close to mouth should improve Whisper accuracy compared to built-in earbud mics.

**Caveat**: Lesser-known brand, fewer real-world reports on Linux compatibility. The boom mic must be attached before putting on the earbuds, which adds friction for spontaneous use.

Sources:
- [EMEET AirFlow (official)](https://emeet.com/products/emeet-airflow)
- [TechRadar EMEET AirFlow review](https://www.techradar.com/health-fitness/fitness-headphones/emeet-airflow-review)
- [TechnicallyWell EMEET AirFlow review](https://technicallywell.com/emeet-airflow-review/)

---

### Philips SpeechOne -- PURPOSE-BUILT DICTATION HEADSET

The only headset specifically designed for speech-to-text dictation. Used primarily in medical and legal transcription.

- **Price**: $450-$750 depending on configuration
- **Mic type**: Electret condenser, 10mm capsule, uni-directional, 360-degree adjustable boom arm
- **Mic quality**: Studio-quality with triple-layer noise reduction filter. Frequency response 150-15,000 Hz. SNR > 70 dBA.
- **Wireless tech**: Proprietary 2.4 GHz ISM band (NOT Bluetooth) -- lossless audio, avoids the HFP quality problem entirely
- **Range**: 5m / 16ft (shorter than Bluetooth, designed for desk use)
- **Battery**: 12h recording, >100h standby, wireless charging dock
- **Weight**: 81g (headset with headband)
- **Wearing styles**: Over-head, ear-free (raised off ear), neckband
- **Extras**: Docking station, status light (red=recording), remote control, antimicrobial materials, VoIP compatible

**For STT**: This is the gold standard for dictation microphone quality. The proprietary 2.4 GHz wireless avoids all Bluetooth codec issues. However, it is expensive, not portable (short range, needs docking station), and designed for sit-at-desk medical dictation rather than mobile use.

**Linux compatibility**: Unknown. The docking station connects via USB, so it likely presents as a standard USB audio device. Worth testing if you can justify the price.

Sources:
- [Philips SpeechOne (official)](https://www.dictation.philips.com/us/products/desktop-dictation/speechone-wireless-dictation-headset-psm6000/)
- [DictationOne: Philips PSM6500](https://www.dictationone.com/Philips-PSM6500-Wireless-Dictation-Headset-Docking-Station-and-Status-Light.html)

---

### Naenka (NANK) -- BUDGET BONE CONDUCTION

Naenka/NANK is the primary budget alternative to Shokz for bone conduction.

- **Price**: $60-$120 depending on model
- **Bluetooth**: 5.4 (newer than most Shokz models)
- **Water resistance**: Up to IP69 (best in class)
- **Sound quality**: Good but Shokz has the edge in audio fidelity
- **Mic quality**: Very little information available. Reviews focus on sports/swimming use, not communication.

**Verdict for STT**: Not recommended for dictation. Naenka does not have a communication-focused model with a boom mic. If you need budget bone conduction for fitness with occasional calls, Naenka works. For speech-to-text, Shokz OpenComm2 or EMEET AirFlow are better choices.

Sources:
- [Naenka comparison (official)](https://naenka.com/blogs/products/best-bone-conduction-headphones-of-2025-compare-nank-shokz-h2o-mojawa-more)
- [Tom's Guide: best bone conduction](https://www.tomsguide.com/buying-guide/best-bone-conduction-headphones)

---

### DECT Wireless Headsets -- BEST MIC QUALITY (NOT OPEN-EAR)

DECT (Digital Enhanced Cordless Telecommunications) headsets provide better audio quality than Bluetooth for bidirectional voice, with much longer range. These are traditional office headsets (not bone conduction or open-ear).

Key options:
- **Poly Savi W745**: Three wearing styles (headband, neckband, ear hook). DECT technology provides better accuracy than Bluetooth for dictation. ~$200-300.
- **Jabra Engage 75**: Connects to 2 Bluetooth + 2 USB + 1 analog. Mono or stereo. ~$300-400.
- **Jabra Pro 920 Mono**: Entry-level DECT. ~$150.
- **Poly CS540A**: Lightweight single-ear DECT. ~$200.

**For STT**: DECT provides the best wireless mic quality for dictation -- significantly better than Bluetooth HFP. The trade-off is these are traditional single-ear headsets, not open-ear bone conduction. They also require a base station (tied to a desk). If you prioritize transcription accuracy over the bone conduction form factor, DECT is worth considering.

Sources:
- [G2 Speech: headsets for speech recognition](https://www.g2speech.com/solutions/hardware/headsets/)
- [KnowBrainer forum: one ear headset recommendations](https://forums.knowbrainer.com/forum/dragon-speech-recognition/2818-one-ear-headset-recommendations-for-v16)
- [Jabra: DECT vs Bluetooth](https://www.jabra.com/blog/dect-vs-bluetooth-how-to-choose-right-wireless-headset/)

---

## Comparison Table

| Model | Price | Mic Type | Mic Quality | Bone Conduction | Open Ear | USB Dongle | Linux Dongle | Battery | Weight | Form Factor |
|-------|-------|----------|-------------|-----------------|----------|------------|-------------|---------|--------|-------------|
| **Shokz OpenComm2 (2025)** | $160-200 | Boom (NC, DSP) | Excellent | Yes | Yes | UC: Loop120 | Broken | 16h talk | 35g | Wrap-around |
| **Shokz OpenMeet UC** | $220-250 | Dual boom (cVc) | Excellent | Yes (hybrid) | Yes | Loop120 | Broken | 14h talk | 78g | Over-head |
| **Shokz OpenFit 2+** | $200 | 4x built-in (AI) | Good | No | Yes | No | N/A | 11h | 9.4g/bud | TWS earbuds |
| **Shokz OpenRun Pro 2** | $140-180 | Dual built-in (AI) | Poor | Yes | Yes | No | N/A | 12h | 31g | Wrap-around |
| **EMEET AirFlow** | $80 | 2 built-in + boom | Good | No | Yes | Yes (USB-A) | Unknown | 20h talk | 8.5g/bud | TWS earbuds |
| **Philips SpeechOne** | $450-750 | Condenser boom | Studio | No | Configurable | 2.4 GHz dock | Unknown | 12h | 81g | Over-head |
| **Poly Savi W745** | $200-300 | Boom (NC) | Excellent | No | No (single-ear) | DECT base | N/A | 7h | ~25g | Ear hook |

---

## Recommended Configurations by Use Case

### Desktop Dictation (macOS)

**Best**: Shokz OpenComm2 UC (2025 Upgrade)
- The USB dongle works on macOS, providing stable connection and automatic profile switching
- Boom mic provides the best Whisper transcription accuracy of the Shokz options
- 16h battery easily covers a full work day
- Bone conduction keeps ears open for environment awareness

**Budget alternative**: EMEET AirFlow with USB dongle

### Desktop Dictation (Linux)

**Best**: Shokz OpenComm2 (standard, NOT UC) + USB microphone

The optimal Linux setup separates input and output:

1. **Output**: OpenComm2 paired via Bluetooth in A2DP mode for TTS playback and audio
2. **Input**: A USB microphone or laptop built-in mic for speech-to-text
3. **Why**: The USB dongle does not work on Linux, and Bluetooth HFP mic quality is too poor for reliable Whisper transcription

Use `pavucontrol` or PipeWire settings to route:
- Default sink (output) = Bluetooth headset (A2DP)
- Default source (input) = USB mic or built-in mic

This avoids the HFP quality penalty entirely while maintaining the open-ear bone conduction experience for hearing your environment and TTS responses.

**If you insist on using the headset mic**: Enable mSBC for the best available (still mediocre) quality. Test with your specific hardware -- results vary widely.

### Mobile Dictation (Android)

**Best**: Shokz OpenFit 2+ or OpenComm2

On Android, Bluetooth profile switching is handled transparently by the OS. The quality limitation still exists but Android's tight integration with Bluetooth makes it less painful than Linux. Android also has excellent on-device speech recognition (Google, FUTO Voice Input) that is more tolerant of Bluetooth mic quality than desktop Whisper.

The OpenFit 2+ is more discreet for public use. The OpenComm2 has a better mic but the boom arm is more conspicuous.

### Walking/Mobile Dictation

**Best**: Shokz OpenFit 2+ (most discreet) or OpenComm2 (better mic)

Both allow environmental awareness while walking. The OpenFit 2+ looks like normal earbuds and draws no attention. The OpenComm2's boom mic is more visible but provides better voice capture.

### Maximum Transcription Accuracy (Any Platform)

**Best**: Philips SpeechOne or a quality USB condenser microphone

If transcription accuracy is paramount and you are working at a desk, skip Bluetooth entirely. A wired USB microphone provides the highest quality input for Whisper. The Philips SpeechOne uses proprietary 2.4 GHz wireless that avoids all Bluetooth codec issues while remaining wireless.

If you want open-ear awareness + maximum mic quality: wear bone conduction headphones for audio output only, and use a desk USB microphone for input.

---

## Summary of Key Findings

1. **Shokz OpenComm2 is the best bone conduction headset for speech-to-text**, thanks to its boom mic with noise cancellation. The OpenMeet UC is a close second with potentially better sound quality.

2. **The Bluetooth HFP microphone quality problem is real and unavoidable** with current Bluetooth technology. On macOS, USB dongles help. On Linux, USB dongles are broken and direct Bluetooth HFP quality is poor.

3. **On Linux, the best approach is split audio**: bone conduction headset for A2DP output + separate USB/built-in mic for input. This is the only way to get both open-ear awareness and good Whisper transcription accuracy.

4. **No wired USB bone conduction headsets exist.** Every bone conduction headset on the market is wireless Bluetooth. The closest to "wired" is the USB dongle approach (still wireless between dongle and headset).

5. **Bluetooth LE Audio (LC3) will eventually solve this** by supporting simultaneous high-quality stereo output and microphone input. Linux support is experimental today, with full qualification expected in 2026.

6. **For pure dictation accuracy, DECT or USB wired microphones still outperform any Bluetooth solution.** If you are willing to sacrifice the bone conduction form factor, a Poly Savi DECT headset or USB condenser mic will give better results.

7. **The Shokz OpenFit 2+ is the best option for discreet public use**, though its built-in mics (no boom) are less optimal for dictation than the OpenComm2's boom mic.

---

## Sources

### Shokz Products
- [Shokz OpenComm2 UC 2025 (official)](https://shokz.com/products/opencomm2uc-2025-upgrade)
- [Shokz OpenComm2 2025 (official)](https://shokz.com/pages/opencomm2-2025-upgrade)
- [Shokz OpenMeet UC (official)](https://pro.shokz.com/products/openmeet-uc)
- [Shokz OpenFit 2 (official)](https://shokz.com/products/openfit2)
- [Shokz OpenFit 2+ (official)](https://shokz.com/products/openfit2plus)
- [Shokz product comparison](https://shokz.com/pages/product-comparison)

### Reviews
- [SoundGuys: OpenComm2 UC review](https://www.soundguys.com/shokz-opencomm2-uc-review-103856/)
- [SoundGuys: OpenMeet UC review](https://www.soundguys.com/shokz-openmeet-uc-review-130252/)
- [SoundGuys: OpenFit 2 review](https://www.soundguys.com/shokz-openfit-2-review-iteration-done-right-133776/)
- [SoundGuys: OpenRun Pro 2 review](https://www.soundguys.com/shokz-openrun-pro-2-review-127935/)
- [SoundGuys: best bone conduction headphones](https://www.soundguys.com/best-bone-conduction-headphones-30293/)
- [TechRadar: EMEET AirFlow review](https://www.techradar.com/health-fitness/fitness-headphones/emeet-airflow-review)
- [Tom's Guide: best bone conduction](https://www.tomsguide.com/buying-guide/best-bone-conduction-headphones)

### Dictation-Specific
- [KnowBrainer: Shokz mic experiences](https://forums.knowbrainer.com/forum/microphones-and-sound-cards/103-disappointment-with-schokz-mic)
- [KnowBrainer: OpenComm2 UC with Dragon](https://forums.knowbrainer.com/forum/microphones-and-sound-cards/5698-problem-using-shokz-opencomm2-uc-microphone-with-dragon)
- [Dolbey: best microphones for dictation 2025](https://www.dolbeyspeech.com/blog/dictation-microphones/)
- [Philips SpeechOne (official)](https://www.dictation.philips.com/us/products/desktop-dictation/speechone-wireless-dictation-headset-psm6000/)

### Linux Bluetooth Issues
- [Ubuntu Bug #2048897: Shokz Loop110 broken](https://bugs.launchpad.net/bugs/2048897)
- [Arch Linux: USB headset not showing mic](https://bbs.archlinux.org/viewtopic.php?id=289616)
- [ArchWiki: PipeWire](https://wiki.archlinux.org/title/PipeWire)
- [ArchWiki: Bluetooth headset](https://wiki.archlinux.org/title/Bluetooth_headset)
- [WirePlumber Bluetooth configuration](https://pipewire.pages.freedesktop.org/wireplumber/daemon/configuration/bluetooth.html)
- [PipeWire Bluetooth status (Collabora)](https://www.collabora.com/news-and-blog/news-and-events/pipewire-bluetooth-support-status-update.html)

### Bluetooth Audio Technology
- [SoundGuys: LE Audio and LC3 explained](https://www.soundguys.com/bluetooth-le-audio-lc3-explained-28192/)
- [Bluetooth SIG: LE Audio](https://www.bluetooth.com/learn-about-bluetooth/feature-enhancements/le-audio/)
- [BlueZ: LE Audio support in PipeWire](https://www.bluez.org/le-audio-support-in-pipewire/)
- [GitHub: Bluetooth HFP quality explanation](https://gist.github.com/danielrosehill/304da00ecbccdbc48986a4462f11a059)
- [GitHub: Optimal audio settings for Whisper](https://gist.github.com/danielrosehill/06fb17e7462980f99efa9fdab2335a14)

### Other Products
- [EMEET AirFlow (official)](https://emeet.com/products/emeet-airflow)
- [Naenka comparison](https://naenka.com/blogs/products/best-bone-conduction-headphones-of-2025-compare-nank-shokz-h2o-mojawa-more)
- [G2 Speech: headsets for speech recognition](https://www.g2speech.com/solutions/hardware/headsets/)
- [Jabra: DECT vs Bluetooth](https://www.jabra.com/blog/dect-vs-bluetooth-how-to-choose-right-wireless-headset/)
- [HeadsetAdvisor: best bone conduction for calls](https://headsetadvisor.com/blogs/headset/1-best-bone-conduction-headset-with-microphone-for-business-calls)
