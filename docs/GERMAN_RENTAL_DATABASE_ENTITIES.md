# 🏠 SichrPlace German Rental Platform - Database Entities Documentation

## 📊 Complete Entity Overview

Your SichrPlace platform now has a **comprehensive German rental market database** with proper terminology and structure.

---

## 🏗️ **Core Database Entities**

### **1. Users (Benutzer) - Enhanced German Format**

| **German Field** | **English Equivalent** | **Type** | **Description** |
|------------------|------------------------|----------|-----------------|
| `anrede` | salutation | VARCHAR(10) | Herr, Frau, Divers |
| `titel` | title | VARCHAR(20) | Dr., Prof., etc. |
| `vorname` | first_name | VARCHAR(100) | First name |
| `nachname` | last_name | VARCHAR(100) | Last name |
| `geburtsdatum` | date_of_birth | DATE | Birth date |
| `geburtsort` | place_of_birth | VARCHAR(100) | Birth place |
| `staatsangehoerigkeit` | nationality | VARCHAR(50) | Nationality (default: Deutsch) |
| `telefon` | phone | VARCHAR(20) | Phone number |
| `mobil` | mobile | VARCHAR(20) | Mobile number |
| `strasse` | street | VARCHAR(255) | Street name |
| `hausnummer` | house_number | VARCHAR(10) | House number |
| `plz` | postal_code | VARCHAR(5) | German ZIP code (5 digits) |
| `ort` | city | VARCHAR(100) | City |
| `bundesland` | state | VARCHAR(50) | German federal state |

**User Types (Roles):**
- `mieter` - Tenant/Applicant
- `vermieter` - Landlord
- `admin` - Administrator
- `kundenmanager` - Customer Manager

---

### **2. Apartments (Wohnungen) - Complete German Rental Structure**

#### **🏠 Basic Property Information**
| **Field** | **Type** | **Description** |
|-----------|----------|-----------------|
| `titel` | VARCHAR(255) | Property title |
| `beschreibung` | TEXT | Property description |

#### **📍 German Address Format**
| **Field** | **Type** | **Description** |
|-----------|----------|-----------------|
| `strasse` | VARCHAR(255) | Street name |
| `hausnummer` | VARCHAR(10) | House number |
| `zusatz` | VARCHAR(100) | Additional info (Apt, Floor) |
| `plz` | VARCHAR(5) | German ZIP code |
| `ort` | VARCHAR(100) | City |
| `bundesland` | VARCHAR(50) | Federal state |
| `stadtteil` | VARCHAR(100) | District/Neighborhood |
| `lage_beschreibung` | TEXT | Location description |

#### **💰 German Rental Pricing Structure**

| **German Term** | **Field** | **Type** | **Description** |
|-----------------|-----------|----------|-----------------|
| **Kaltmiete** | `kaltmiete` | DECIMAL(10,2) | Cold rent (base rent without utilities) |
| **Nebenkosten Warm** | `nebenkosten_warm` | DECIMAL(10,2) | Heating costs |
| **Nebenkosten Kalt** | `nebenkosten_kalt` | DECIMAL(10,2) | Cold utilities (water, garbage, etc.) |
| **Betriebskosten** | `betriebskosten` | DECIMAL(10,2) | Operating costs |
| **Heizkosten** | `heizkosten` | DECIMAL(10,2) | Heating costs (separate) |
| **Warmmiete** | `warmmiete` | DECIMAL(10,2) | **AUTO-CALCULATED** Warm rent (kaltmiete + nebenkosten) |
| **Kaution** | `kaution` | DECIMAL(10,2) | Security deposit (typically 2-3 months rent) |
| **Provision** | `provision` | DECIMAL(10,2) | Broker/commission fee |

**Kaution Types:**
- `geld` - Cash deposit
- `buergschaft` - Bank guarantee  
- `bankgarantie` - Bank surety

#### **🏡 Property Details**
| **German Field** | **English** | **Type** | **Description** |
|------------------|-------------|----------|-----------------|
| `wohnflaeche` | living_space | INTEGER | Living area in sqm |
| `gesamtflaeche` | total_area | INTEGER | Total area in sqm |
| `zimmer` | rooms | INTEGER | Number of rooms |
| `schlafzimmer` | bedrooms | INTEGER | Number of bedrooms |
| `badezimmer` | bathrooms | INTEGER | Number of bathrooms |
| `balkon_terrasse` | balcony_terrace | INTEGER | Number of balconies/terraces |
| `balkon_groesse` | balcony_size | DECIMAL(5,2) | Balcony size in sqm |
| `garten` | garden | BOOLEAN | Has garden |
| `garten_groesse` | garden_size | DECIMAL(10,2) | Garden size in sqm |

#### **🏢 Building Information**
| **Field** | **Type** | **Description** |
|-----------|----------|-----------------|
| `etage` | INTEGER | Floor number |
| `etagen_gesamt` | INTEGER | Total floors in building |
| `aufzug` | BOOLEAN | Has elevator |
| `baujahr` | INTEGER | Year built |
| `saniert_jahr` | INTEGER | Year renovated |
| `bauweise` | VARCHAR(50) | Construction type (Massivbau, Fertigbau) |
| `denkmalschutz` | BOOLEAN | Heritage protection |

#### **⚡ German Energy Certificate (Energieausweis)**
| **Field** | **Type** | **Description** |
|-----------|----------|-----------------|
| `energieausweis_typ` | VARCHAR(20) | 'verbrauch' (consumption) or 'bedarf' (demand) |
| `energieeffizienzklasse` | VARCHAR(5) | A+, A, B, C, D, E, F, G, H |
| `energieverbrauch` | DECIMAL(6,2) | kWh/m²*a |
| `heizungsart` | VARCHAR(50) | Heating type (Zentralheizung, Gasetagenheizung) |
| `energietraeger` | VARCHAR(50) | Energy source (Gas, Öl, Fernwärme) |

#### **🛋️ Furnishing & Features**
| **Field** | **Type** | **Values/Description** |
|-----------|----------|------------------------|
| `moebliert_typ` | VARCHAR(20) | 'unmoebliert', 'teilmoebliert', 'vollmoebliert' |
| `kueche` | VARCHAR(20) | 'keine', 'pantry', 'kochnische', 'einbaukueche', 'offene_kueche' |
| `kueche_ausstattung` | TEXT[] | Kitchen equipment array |
| `bad_ausstattung` | TEXT[] | Bathroom features array |

#### **🚗 Parking & Storage**
| **Field** | **Type** | **Values** |
|-----------|----------|------------|
| `stellplatz` | VARCHAR(20) | 'keiner', 'tiefgarage', 'carport', 'freiplatz' |
| `stellplaetze_anzahl` | INTEGER | Number of parking spaces |

#### **🐕 Pet & Smoking Policy**
| **Field** | **Type** | **Values** |
|-----------|----------|------------|
| `haustiere` | VARCHAR(20) | 'nicht_erlaubt', 'kleine_tiere', 'alle_tiere', 'nach_vereinbarung' |
| `rauchen` | VARCHAR(20) | 'nicht_erlaubt', 'erlaubt', 'nur_balkon' |

#### **📅 Rental Terms**
| **Field** | **Type** | **Description** |
|-----------|----------|-----------------|
| `verfuegbar_ab` | DATE | Available from |
| `verfuegbar_bis` | DATE | Available until |
| `mindestmietdauer` | INTEGER | Minimum rental duration (months) |
| `mietvertrag_typ` | VARCHAR(20) | 'befristet', 'unbefristet', 'zwischenmiete' |
| `vermietung_typ` | VARCHAR(20) | 'langzeit', 'kurzzeitmiete', 'zwischenmiete', 'wg_zimmer' |

---

### **3. Viewing Requests (Besichtigungsanfragen)**

| **German Field** | **English** | **Type** | **Description** |
|------------------|-------------|----------|-----------------|
| `mieter_id` | tenant_id | UUID | References users(id) |
| `vermieter_id` | landlord_id | UUID | References users(id) |
| `wunschdatum_1` | preferred_date_1 | TIMESTAMP | First preferred date |
| `wunschdatum_2` | preferred_date_2 | TIMESTAMP | Second preferred date |
| `wunschdatum_3` | preferred_date_3 | TIMESTAMP | Third preferred date |
| `bestaetigter_termin` | confirmed_date | TIMESTAMP | Confirmed appointment |
| `besichtigungsgebuehr` | viewing_fee | DECIMAL(10,2) | Service fee (default €25) |
| `gebuehr_bezahlt` | fee_paid | BOOLEAN | Fee payment status |
| `kundenmanager_id` | customer_manager_id | UUID | Assigned customer manager |
| `stornierungsgrund` | cancellation_reason | TEXT | Cancellation reason |

**Status Values:**
- `ausstehend` - Pending
- `bestaetigt` - Confirmed  
- `abgeschlossen` - Completed
- `storniert` - Cancelled
- `zahlung_erforderlich` - Payment Required

---

### **4. Payment Transactions (Zahlungstransaktionen)**

| **Field** | **Type** | **Description** |
|-----------|----------|-----------------|
| `payment_id` | VARCHAR(255) | Unique payment ID |
| `amount` | DECIMAL(10,2) | Payment amount |
| `currency` | VARCHAR(3) | Currency (default: EUR) |
| `payment_purpose` | VARCHAR(100) | Payment purpose (default: besichtigungsgebuehr) |
| `viewing_request_id` | UUID | Links to viewing request |

---

### **5. Reviews (Bewertungen)**

| **German Field** | **English** | **Type** | **Description** |
|------------------|-------------|----------|-----------------|
| `gesamtbewertung` | overall_rating | INTEGER | Overall rating (1-5) |
| `vermieter_bewertung` | landlord_rating | INTEGER | Landlord rating (1-5) |
| `lage_bewertung` | location_rating | INTEGER | Location rating (1-5) |
| `preis_leistung_bewertung` | value_rating | INTEGER | Value for money (1-5) |
| `ausstattung_bewertung` | amenities_rating | INTEGER | Amenities rating (1-5) |
| `titel` | title | VARCHAR(255) | Review title |
| `kommentar` | comment | TEXT | Review comment |
| `vorteile` | pros | TEXT | Advantages |
| `nachteile` | cons | TEXT | Disadvantages |
| `empfehlung` | recommendation | BOOLEAN | Would recommend |

---

## 🎯 **Key Features Implemented**

### **✅ German Rental Market Standards**
- **Kaltmiete vs. Warmmiete** - Proper separation of base rent and utilities
- **Automatic Warmmiete Calculation** - `warmmiete = kaltmiete + nebenkosten_warm + nebenkosten_kalt`
- **German Address Format** - PLZ, Ort, Bundesland structure
- **Energy Certificate** - Energieausweis with efficiency classes
- **Kaution Types** - Multiple deposit options

### **✅ Advanced Property Features**
- **Geographic Search** - PostGIS integration for location-based queries
- **Comprehensive Amenities** - Kitchen types, bathroom features, parking options
- **Building Information** - Floor, elevator, year built, construction type
- **German Rental Terms** - Befristet/Unbefristet contracts

### **✅ User Experience**
- **Multi-language Support** - German terminology with English compatibility
- **GDPR Compliance** - Full consent tracking and data processing
- **Service Fees** - €25 default viewing fee (German market standard)
- **Customer Manager System** - Professional viewing coordination

### **✅ Payment Integration**
- **PayPal Integration Ready** - Payment transactions table
- **German Fee Structure** - Provision, Kaution, Nebenkosten
- **Currency Support** - EUR as default with multi-currency support

---

## 🔧 **Database Performance**

### **Optimized Indexes**
- Location-based searches (PostGIS)
- Price range filtering (Kaltmiete, Warmmiete)
- Property features (rooms, area, etc.)
- User management and verification

### **Auto-calculated Fields**
- `warmmiete` - Automatically calculated from Kaltmiete + Nebenkosten
- Proper German rental market pricing structure

---

## 🚀 **Ready for Integration**

Your database is now fully configured for the German rental market with:

1. **✅ Proper German terminology** (Kaltmiete, Warmmiete, Kaution, etc.)
2. **✅ Complete pricing structure** with automatic calculations  
3. **✅ Energy certificates** and building information
4. **✅ Payment system** with viewing fees
5. **✅ User management** with German address format
6. **✅ Review system** with German rating categories
7. **✅ Sample data** with realistic German rental properties

**Your entities are ready for:**
- Frontend integration
- API development  
- Payment processing
- Property management
- User account management
- Viewing request system

Would you like me to help you integrate these entities with your frontend forms or API endpoints?