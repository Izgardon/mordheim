export type RulesTabId =
  | "characteristics"
  | "the-turn"
  | "movement"
  | "shooting"
  | "close-combat"
  | "wounds-and-injuries"
  | "leadership-psychology";

export const rulesTabs = [
  {
    id: "characteristics",
    label: "Characteristics",
    content: `
<p>In Mordheim the warriors each have different
abilities, some being better at certain actions, for
example, fighting, shooting or climbing, than they are
at others. This variety in each warrior is represented
in the form of characteristics and skills. Right now
don’t worry about skills – these come later with
practice and battle experience. For now we just need
to consider a warrior’s characteristics.</p><p>Each model is defined by a set of characteristics:
Movement, Weapon Skill, Ballistic Skill, Strength,
Toughness, Wounds, Initiative, Attacks and
Leadership. Each characteristic is assigned a value of
(usually) between 1 and 10. The higher the value your
model has for any
characteristic the
better – for
example, a model
with a Strength of 6
is stronger than
a model that has a
Strength of 2.</p><h4 id="movement-m">Movement (M)</h4><p>A model’s
Movement rate
shows how far
the model can
move in a
turn, under
normal
conditions.</p><p>For example, a typical Human has a move of 4&quot;, while
a fleet-footed nimble Skaven has a move of 5&quot;.</p><h4 id="weapon-skill-ws">Weapon Skill (WS)</h4><p>Weapon Skill is a measure of
close combat ability (ie, how good the warrior is at
hand-to-hand fighting). A deadly swordsman or a
crazed berserker would have a high value compared
to a lowly acolyte, for example. The higher the WS,
the more likely your warrior is to hit his opponent.</p><h4 id="ballistic-skill-bs">Ballistic Skill (BS)</h4><p>This shows how good a shot
the individual is. When you shoot a bow or fire a
pistol, the chance of hitting a target depends upon
your model’s Ballistic Skill. A normal Human has a BS
of 3, though an experienced marksman might have a
BS of 4, 5 or even higher.</p><h4 id="strength-s">Strength (S)</h4><p>Strength indicates how strong a
warrior is! It is especially important for hand-to-hand
combat, because the stronger you are the harder you
can hit. A Strength value of 3 is about average.</p><h4 id="toughness-t">Toughness (T)</h4><p>This is a measure of how easily an
individual can withstand a hit from a weapon or a
blow from a club or fist. The tougher you are, the
harder you are to wound or kill. An average
Toughness value is 3, though a gnarled old warrior
might have a Toughness of 4!</p><h4 id="wounds-w">Wounds (W)</h4><p>A model’s Wounds value shows how
many times the model can be wounded before it
collapses, is killed or incapacitated. Most individuals
have only 1 Wound but veteran warriors or large
creatures such as Ogres might have more.</p><h4 id="initiative-i">Initiative (I)</h4><p>The Initiative value indicates how fast
and nimble the warrior is. It determines the attacking
order in hand-to-hand combat, and is particularly
important when the model is climbing and moving
amidst the ruins of Mordheim.</p><h4 id="attacks-a">Attacks (A)</h4><p>The Attacks value indicates how many
blows the model can make in hand-to-hand combat.
Most warriors have an Attacks value of 1, but powerful
fighters may have more. The more Attacks you have,
the greater the chance you’ve got of beating your
opponents into an unrecognisable pulp!</p><h4 id="leadership-ld">Leadership (Ld)</h4><p>Leadership represents raw
courage, self control and charisma. The higher the
model’s Leadership value, the more likely he is to
remain steadfast in combat while others run off or are
slain. For example, a cowardly Skaven may have a
Leadership of 5, while a cool, calm Elf could have a
Leadership of 8 or higher.</p><h2 id="zero-level-characteristics">zero level characteristics</h2><p>Some creatures in Mordheim have been given a ‘0’ for
certain characteristics which means that they have no
ability in that field whatsoever. This usually applies to
creatures unable to use missile weapons (who would
have a BS of 0) but it might equally apply to other
characteristics as well.</p><p>If a model has a WS of 0 then it cannot defend itself
in hand-to-hand combat, and any blows struck against
it will automatically hit.</p><h2 id="characteristic-profiles">characteristic profiles</h2><p>A model’s characteristic values are written in the form
of a chart called a characteristics profile (or just
profile).</p><table class="rules-table"><thead><tr><th>Warrior</th><th>M</th><th>WS</th><th>BS</th><th>S</th><th>T</th><th>W</th><th>I</th><th>A</th><th>Ld</th></tr></thead><tbody><tr><td>Dieter Stahl</td><td>4</td><td>3</td><td>3</td><td>3</td><td>3</td><td>1</td><td>3</td><td>1</td><td>7</td></tr></tbody></table><p>The example above is a typical profile for a Human
warrior.</p><p>As you fight in more games against other players, your
warriors will get better and their characteristics may
increase. All these details are recorded using the
Warband roster sheets provided at the back of this
book. This is explained properly later on. For now it
is enough to know what each characteristic is for and
how their values vary.</p><h2 id="characteristic-tests">characteristic tests</h2><p>Often in the game a model will be required to take a
test on one of his own characteristics. In order to pass
this test, the model has to roll a D6 and obtain a result
equal to or lower than the value of the characteristic
involved. Note that if you roll a 6, you automatically
fail the test regardless of the model’s characteristic
value.</p><p><em><strong>For example:</strong> Dieter Stahl is jumping down from a
wall that is 3&quot; high and has to take an Initiative test.
He has an Initiative value of 3 on his characteristic
profile and therefore will be successful if he rolls a 1,
2 or 3 on a D6. If he rolls a 4, 5 or 6 he will fail the
test and fall down, suffering all the painful
consequences!</em></p><h2 id="leadership-tests">leadership tests</h2><p>Tests against the Leadership characteristic are done in
a slightly different way. In the case of a Leadership
test, you should roll two dice and add the two scores
together. If the result is equal to or less than the
model’s Leadership characteristic, the test has been
passed.</p><p><em><strong>For example:</strong> Dieter’s Leadership is 7, so to pass a
Leadership test he must roll 7 or less on 2D6</em></p>
    `,
  },
  {
    id: "the-turn",
    label: "The Turn",
    content: `
<p>In Mordheim you are in a charge of a warband and
your opponent is in charge of another.</p><p>The warriors and scenery in the game are set up on
the tabletop in a way that is appropriate for the
encounter you are fighting. Do not worry about this
for now as these things will be explained in full in the <a href="https://www.mordheimer.net/docs/campaigns/scenarios">Scenarios section</a>.</p><p>To play, one side takes a turn, then the other side,
then the original side and so on, much like in a game
of draughts or chess. When it is your turn, you may
move all your models, shoot with any warriors able
to do so, and fight in hand-to-hand combat. Once
your turn is complete, it is your opponent’s
turn to move, shoot and fight.</p><div class="rules-callout"><div class="rules-callout__title">Turn sequence</div><div class="rules-callout__body"><h3 id="1-recovery">1. Recovery</h3><p>During the recovery phase you may attempt
to rally individuals who have lost their nerve
and recover models that are knocked down
or stunned.</p><h3 id="2-movement">2. Movement</h3><p>During the movement phase you may move
the warriors of your warband according to
the rules given in the <a href="https://www.mordheimer.net/docs/rules/movement">Movement section</a>.</p><h3 id="3-shooting">3. Shooting</h3><p>In the shooting phase you may shoot with
any appropriate weapons as described in the
rules for shooting.</p><h3 id="4-hand-to-hand-combat">4. Hand-to-hand combat</h3><p>During the hand-to-hand combat phase all
models in hand-to-hand combat may fight.
Note that both sides fight in the hand-to-hand combat phase, regardless of whose turn
it is.</p></div></div><h2 id="phases">phases</h2><p>To keep track of who
is doing what and
when, each turn
is split into
four phases.
This is called
the <em>Turn
sequence</em>.</p><h2 id="recovery-phase">recovery phase</h2><p>During the recovery phase you may attempt to rally
any of your models who have lost their nerve (see the
Recovery Phase rules). To take a Rally test, roll 2D6. If
the score is equal to or less than the model’s
Leadership value the model stops fleeing and has
rallied; turn it to face in any direction you wish. The
model cannot move or shoot for the rest of the turn,
but models able to do so can cast spells. If the test is
failed, the model will continue to flee towards the
closest table edge.</p><p>Note that a model <strong>cannot</strong> rally if the closest model to
him is an enemy model (<em>fleeing</em>, <em>stunned</em>, <em>knocked down</em> and <em>hidden</em> models are not taken into
consideration for this).</p><p>During the recovery phase, warriors in your
warband who have been <em>stunned</em> become
<em>knocked down</em> instead and warriors who
have been <em>knocked down</em> may stand up
(see the <a href="https://www.mordheimer.net/docs/rules/wounds-and-injuries">Injuries section</a>).</p>
    `,
  },
  {
    id: "movement",
    label: "Movement",
    content: `
<div class="rules-callout"><div class="rules-callout__title">Movement Order</div><div class="rules-callout__body"><p><strong><em>During the movement phase models are moved in the following order:</em></strong></p><h3 id="1-charge">1. Charge!</h3><p>If you want a model in your warband to charge at an
enemy model and attack it in hand-to-hand combat
then you must do this at the start of the movement
phase before moving any of your other models.
When you charge a model, declare to your opponent
that you are doing so and indicate which of his
models it is attacking.</p><h3 id="2-compulsory-moves">2. Compulsory Moves</h3><p>Sometimes a model is forced to move in a certain way
and this is called a compulsory move. For example, a
fighter whose nerve breaks must run away from his
enemies and take cover.
Make all of your models’ compulsory moves before
finishing any remaining movement.</p><h3 id="3-remaining-moves">3. Remaining Moves</h3><p>Once you have moved
your chargers and made
any compulsory moves,
you may move the rest of
your warriors as you see fit.</p></div></div><h2 id="moving">moving</h2><p>During their movement phase, models can move up
to their movement rate in any direction. They may
move (including running and charging) up and down
ladders and stairs, and over low obstacles such as
barrels, boxes, etc.</p><p>In normal circumstances models don’t have to move
their full distance, or at all if you do not want them to.
All exceptions are explained later and invariably
involve either charging or compulsory moves.</p><h2 id="running">running</h2><p>The normal Movement value of models represents a
warrior moving at a fairly rapid rate, but allows time
for him to aim and shoot a weapon and generally
observe what is going on around him. If you wish, a
model may move much quicker than this – he can
run! A running warrior can move at double speed (for
example, 8&quot; rather than 4&quot;). Note that running is not
the same as charging as it does not allow your model
to engage the enemy in hand-to-hand combat.</p><p>A model can only run if there are no enemy models
within 8&quot; of it at the start of the turn (fleeing, stunned,
knocked down and hidden models do not count).
Check this distance after any charges have been
declared. If there are any enemies within 8&quot; at the
start of the turn, the model will prepare to fight
instead and so is unable to run. The running model
can move closer than 8&quot; to an enemy as it moves.</p><p>Any model that runs loses its chance to shoot during
that turn. He is concentrating on running and is not
prepared to fight, having sheathed or shouldered his weapons. You should declare that models are running as they move, as this will remind both
players that the model is unable to
shoot that turn. Running models
can cast spells as normal.</p><h2 id="charge">charge!</h2><p>If you want a model to
engage the enemy in
hand-to-hand combat
then you must
make a special
move called a
charge. Without
measuring the
distance,
declare that
your model
is charging
and
indicate which enemy model he is going to attack.</p><p>You can charge any opposing model if you can draw
an unobstructed line from your model to the target. If
your warrior wants to charge an enemy model within
4&quot; that he can’t see (eg, because it is behind a corner)
but has not been declared as hidden, he must pass an
Initiative test to detect it. If he fails the roll, your
model may not charge this turn, but may move his
normal distance, shoot and cast spells.</p><p>A charge is like a running move, performed at double
the Movement rate, but ends with the attacker moving
by the most direct route into base-to-base contact
with the enemy model. Once their bases are touching
they are engaged in hand-to-hand combat. Models are
also considered to be in hand-to-hand combat even
when separated by a low wall or obstacle, where it is
impossible for the bases to touch physically because
the obstacle is in the way.</p><p><img decoding="async" loading="lazy" alt=" " src="https://www.mordheimer.net/assets/images/charge-879c3346865cd419bc1c1aa9fa07c4a8.jpg" width="516" height="610"></p><p>If an unengaged (ie, not in hand-to-hand combat)
enemy model lies within 2&quot; of the charge route, that
model may choose to intercept the charger if he
wishes. This ‘interception area’ is shown in the
diagram above. Only one enemy model may attempt
to intercept each charger.</p><p>If the intercepting warrior
would normally require a  test to engage the
charger then he must pass one in order to be allowed
to intercept. Failure means he will not move. If the
intercepting warrior causes fear then move the
models into contact and then take a Fear test for the
original charger (assuming he would normally do so)
as if he was the one being charged. Regardless of the
results of this test it is still the original charger who
counts as charging in the subsequent round of
combat, not the intercepting warrior.</p><p>Sometimes a charging warrior may not reach the
enemy because you have miscalculated the distance.
If this happens move your warrior his normal move
distance towards the enemy. This is called a failed
charge. The model cannot shoot in the same turn in
which he failed a charge, but he can cast spells as
normal.</p><p>Models cannot be moved into hand-to-hand combat
except by charging – any move that brings a warrior
into hand-to-hand combat is a charge by definition. A
model that charges will ‘strike first’ in the first round
of the ensuing combat.</p><h2 id="charging-more-than-one-opponent">charging more than one opponent</h2><p>If you can move your warrior into base contact with
more than one enemy model with its charge move, it
can charge them both. This might be inadvisable as
it’ll then be fighting two enemies at once!</p><h2 id="hiding">hiding</h2><p>The Hiding rule represents warriors concealing
themselves in a way that our unmoving and
dramatically posed models cannot. A hiding warrior
keeps as still as possible, just peeking out of cover.</p><p>A model can hide if he ends his move behind a low
wall, a column or in a similar position where he could
reasonably conceal himself. The player must declare
that the warrior is hiding and place a Hidden counter
beside the model for it to count as being hidden.</p><p>A model that runs, flees, is stunned or charges cannot
hide that turn. His sudden burst of speed does not
give him time to hide.</p><p>A model may stay hidden over several turns, so long
as he stays behind a wall or similar feature. He may
even move around so long as he stays hidden while
doing so. If an enemy moves so that he can see the
hidden warrior, the model is no longer hidden and
the counter is removed. When hidden, a warrior
cannot be seen, shot at or charged.</p><p>While hiding, a model cannot shoot or cast spells
without giving away its position. If a hidden model
shoots, or moves so that he can be seen, he is no
longer hidden and can be shot at as normal.</p><p>A model may not hide if he is too close to an enemy
model – he will be seen or heard no matter how well
concealed. Enemy warriors will always see, hear or
otherwise detect hidden foes within their Initiative
value in inches. So a warrior whose Initiative value is
3 will automatically spot all hidden enemies within 3&quot;.</p><h2 id="terrain">terrain</h2><p>The ruined city of Mordheim is a dark and dangerous
place, where tumbled down towers and blasted
houses form a vast maze of streets and alleyways.</p><h4 id="open-ground">open ground</h4><p>The tabletop surface, floors of buildings, connecting
overhangs, ladders and ropes are all considered to be
open ground and will not affect movement even if the
model is charging. It can also go through doors and
hatches without slowing down.</p><h4 id="difficult-ground">difficult ground</h4><p>Difficult ground includes steep or treacherous slopes,
bushes and the angled roofs of buildings. Models
move at half speed over difficult terrain.</p><h4 id="very-difficult-ground">very difficult ground</h4><p>This is really dangerous terrain, such as narrow
crawlholes through the rubble. Models may move at a
quarter rate, so if the model moves 4&quot; over open
ground it can only move 1&quot; over very difficult ground.</p><h4 id="walls-and-barriers">walls And barriers</h4><p>Walls, hedges and other low obstacles form barriers
that you can either go around or leap over. A model
can leap over a barrier that is less than 1&quot; high. This
does not affect its movement in any way.</p><h2 id="climbing">climbing</h2><p>Often the ruined buildings of Mordheim do not have
stairs or ladders, so your warriors will have to climb
to reach the upper floors of buildings.</p><p>Any model (except animals!) can climb up or down
fences, walls, etc. He must be touching what he wants
to climb at the start of his movement phase. He may
climb up to his total Movement in a single movement
phase (but cannot run while he is climbing). Any
remaining movement can be used as normal. If the
height is more than the model’s normal
move, he cannot climb the wall.</p><p>To climb, a model must take an Initiative test. If he fails it whilst climbing up, he cannot move that turn. If he fails it while climbing down, he falls from where he started his descent (see the <a href="#falling">Falling section</a>).</p><h2 id="jumping-down">jumping down</h2><p><img decoding="async" loading="lazy" alt=" " src="https://www.mordheimer.net/assets/images/jumping-down-4d84a16837ae5117bdcca8f06db4de91.jpg" width="501" height="294"><br><em>The Skaven runs/charges from the top of a building, jumping
down during the move. It moves 3&quot; to reach the edge, then
jumps down and has to see whether it can safely make it to the
ground. As it has to jump down 5&quot;, it must pass two Initiative
tests to avoid taking D3 S5 hits. If it fails it will stop its move at
the bottom of the wall (if it is not taken out of action). If it
passes both tests, it can continue its run/charge and move the
remaining 7&quot;</em></p><p>Your warrior may jump down from high places (up to
a maximum height of 6&quot;) such as walkways and
balconies at any time during his movement phase.
Take an Initiative test for every full 2&quot; he jumps down.
If he fails any of the tests, the model falls from the
point where he jumped, takes damage (see Falling)
and may not move any more during the movement
phase. If successful, the model can continue his
movement as normal (jumping down does not use up
any of the model’s Movement allowance).</p><h2 id="diving-charge">diving charge</h2><p>You may charge any enemy troops that are below a
balcony or overhang, etc, that your model is on. If an
enemy model is within 2&quot; of the place where your
warrior lands, he may make a diving charge against it.
Take an Initiative test for each full 2&quot; of height your
model jumped down from, up to a maximum of 6&quot;,
like a normal jump. If he fails any of them, your model
has fallen and suffers damage, may not move any
more during the movement phase and cannot charge
the enemy. If he succeeds, the model gains a +1
Strength bonus and +1 to hit bonus but only during
the following hand-to-hand combat phase.</p><h2 id="jumping-over-gaps">jumping over gaps</h2><p>Models may jump over gaps (up to a maximum of 3&quot;)
and streets, (eg, from the roof of a building to
another). Deduct the distance jumped from the
model’s movement but remember that you cannot
measure the distance before jumping. If your model
does not have enough movement to jump the
distance, he automatically falls. If your model is able
to cover the distance, he must pass an Initiative test or
fall. A model may jump over a gap and still fire a
missile weapon if it is not running. It may also jump
as part of its charge or running move.</p><h2 id="warriors-knocked-down-or-stunned">warriors knocked down or stunned</h2><p>If a warrior is <a href="https://www.mordheimer.net/docs/rules/wounds-and-injuries">knocked down or stunned</a> within 1&quot; of the edge of
a roof or building, there is a chance that it will slip
and fall off. Take an Initiative test. If the test is failed,
the model falls over the edge to the ground and takes
damage as detailed below.</p><h2 id="falling">falling</h2><p>A model that falls takes D3 hits at a Strength equal to
the height in inches that it fell (eg, if the model fell 4&quot;,
it would take D3 hits at Strength 4). No armour saves
apply.  A
model that falls may not move any further or hide
during that turn, even if it is not hurt.</p>
    `,
  },
  {
    id: "shooting",
    label: "Shooting",
    content: `
<p>Warriors that fight in the ruins of Mordheim are
usually armed to the teeth! Individual warriors
often have several different weapons such as swords,
knives, bows and even blackpowder weapons.
During your warband’s shooting phase each of your
warriors may shoot once with one of his weapons.
This means that he can fire a bow, shoot with a
crossbow, or hurl a throwing knife, for example.
Work through the models one at a time. Pick which
fighter is going to shoot, nominate his target, work
out whether he hits the enemy and, if he does, any
wounds or injuries that are caused. Then continue
with the next shooter. You can take shots in any order
you wish. Be sure to remember or note down which
models have already shot.</p><h2 id="who-can-shoot">who can shoot</h2><p>Each model can shoot once in the shooting phase, so
long as he can see a target and assuming he has a
suitable weapon. He may not fire in the following
circumstances: if he is engaged in hand-to-hand
combat, has run or failed a charge in the movement
phase, has rallied this turn or is stunned or knocked
down.</p><p>To shoot at a target, a model must be able to see it,
and the only way to check this is to stoop over the
tabletop for a model’s eye view. Models can see all
around themselves (ie, 360°), and they may be turned
freely to face in any direction before firing. Note that
turning on the spot does not count as moving.</p><h3 id="closest-target">closest target</h3><p>You must shoot at the closest enemy, as he represents
the most immediate threat and therefore the most
obvious target. However, you may shoot at a more
distant target if it is easier to hit or if closer models are
stunned or knocked down (see diagram on next
page). For example, a closer target may be hard to hit
because it is in cover, whilst a more distant target
might be in the open and therefore an easier shot.</p><p>You may always choose to shoot at a Large Target if
you can see it, whether it is in cover or not and even
if it is not the closest target.</p><p>You can shoot at models that are fleeing, knocked
down or stunned, but you can choose to ignore them,
because they do not represent an immediate threat. It
is better to shoot the closest standing enemy model
instead.</p><p>Note that you may not shoot at models that are
engaged in hand-to-hand combat, as the risk of hitting
your comrades is too great.</p><h3 id="cover">cover</h3><p>The many walls, ruined buildings and other masonry
in Mordheim offer plenty of cover. If any portion of
the target is hidden by a piece of scenery or another
model, the shooting model will suffer a penalty as
explained below.</p><p><img decoding="async" loading="lazy" src="https://www.mordheimer.net/assets/images/targets-in-cover-27133f14b0d8064ca4b6510a5aad972a.jpg" width="717" height="1084"></p><p>Sometimes it will be obvious whether a target can be
seen; at other times it will be more difficult, as
buildings and other scenery are in the way. If the
shooter can see only part of the target’s body, the
target is in cover and the shooter suffers a -1 penalty
on his To Hit roll.</p><p>If a shot misses its target by 1, and that target claimed
the -1 modifier for cover, then the shot strikes the
cover instead. Normally this doesn’t matter, but in the
case where a model is concealed behind another
warrior, or when the cover is a powder keg, it might
be extremely important!</p><p><img decoding="async" loading="lazy" src="https://www.mordheimer.net/assets/images/shooting-5d9134a510af2e94ed2d6d9d9f94ab7c.jpg" width="519" height="687"></p><p><em>Here, the closest target (A) is behind cover and so is harder to
hit than the more distant targets B, C and D. In this situation
the firer may shoot at target B even though he is further away
than A</em></p><h3 id="shooting-from-an-elevated-position">shooting from an elevated position</h3><p>A model situated in an elevated position (ie, anything
that is more than 2&quot; above the table surface, such as
an upper floor of a building), may freely pick any
target he can see and shoot at it. The exception to this
rule is that if there are enemies in the same building
and in line of sight of the shooter, he must shoot at
these, as they present a more immediate threat.</p><h2 id="range">range</h2><p>Once you have decided to shoot and have chosen a
target you must measure to see whether the shot is
within range. Each type of missile weapon has a
maximum range, as described in the <a href="https://www.mordheimer.net/docs/weapons-armour">Weapons &amp; Armour section</a> of the book.</p><p>Assuming that your target is within range your warrior
can proceed with the shot. If the target is out of range
then he has automatically missed this turn.</p><h2 id="hitting-the-target">hitting the target</h2><p>To determine whether a shot hits its target, roll a D6.
The dice score needed will depend upon how good a
shot the firer is (as indicated by his Ballistic Skill). The
chart below shows the minimum D6 roll needed to
score a hit.</p><table class="rules-table"><thead><tr><th><strong>BS of shooter</strong></th><th>1</th><th>2</th><th>3</th><th>4</th><th>5</th><th>6</th><th>7</th><th>8</th><th>9</th><th>10</th></tr></thead><tbody><tr><td>D6 roll needed</td><td>6</td><td>5</td><td>4</td><td>3</td><td>2</td><td>1</td><td>0</td><td>-1</td><td>-2</td><td>-3</td></tr></tbody></table><h3 id="hit-modifiers">hit modifiers</h3><p>It is easier to hit a target that is in the open compared to a target behind cover. Usually it is also easier to hit a target if it is close compared to one further away. These situations are represented by the following modifiers:</p><table class="rules-table"><thead><tr><th>Modifier</th><th>Reason</th><th>Description</th></tr></thead><tbody><tr><td>-1</td><td>Cover</td><td>If any part of the model is obscured by scenery or other models then it counts as being in cover.</td></tr><tr><td>-1</td><td>Long range</td><td>If you are shooting at a target that is more than half of your weapon’s maximum range away.</td></tr><tr><td>-1</td><td>Moving &amp; shooting</td><td>If your model has moved at all (other than standing up, or turning to face your target) during this turn.</td></tr><tr><td>+1</td><td>Large target</td><td>If either the target model has the Large Target special rule (such as an Ogre), or whose main ‘body’ is over 2&quot; tall or wide (such as most buildings).</td></tr></tbody></table><h2 id="wound-chart">wound chart</h2><p><img decoding="async" loading="lazy" src="https://www.mordheimer.net/assets/images/wound-chart-a92e853211e30e1a862a83aff0d1dd94.jpg" width="1151" height="649"></p><p>target&#x27;s toughness (horizontal) vs weapon strength (vertical)</p><table class="rules-table"><thead><tr><th></th><th><strong>1</strong></th><th><strong>2</strong></th><th><strong>3</strong></th><th><strong>4</strong></th><th><strong>5</strong></th><th><strong>6</strong></th><th><strong>7</strong></th><th><strong>8</strong></th><th><strong>9</strong></th><th><strong>10</strong></th></tr></thead><tbody><tr><td><strong>1</strong></td><td>4</td><td>5</td><td>6</td><td>6</td><td>–</td><td>–</td><td>–</td><td>–</td><td>–</td><td>–</td></tr><tr><td><strong>2</strong></td><td>3</td><td>4</td><td>5</td><td>6</td><td>6</td><td>–</td><td>–</td><td>–</td><td>–</td><td>–</td></tr><tr><td><strong>3</strong></td><td>2</td><td>3</td><td>4</td><td>5</td><td>6</td><td>6</td><td>–</td><td>–</td><td>–</td><td>–</td></tr><tr><td><strong>4</strong></td><td>2</td><td>2</td><td>3</td><td>4</td><td>5</td><td>6</td><td>6</td><td>–</td><td>–</td><td>–</td></tr><tr><td><strong>5</strong></td><td>2</td><td>2</td><td>2</td><td>3</td><td>4</td><td>5</td><td>6</td><td>6</td><td>–</td><td>–</td></tr><tr><td><strong>6</strong></td><td>2</td><td>2</td><td>2</td><td>2</td><td>3</td><td>4</td><td>5</td><td>6</td><td>6</td><td>–</td></tr><tr><td><strong>7</strong></td><td>2</td><td>2</td><td>2</td><td>2</td><td>2</td><td>3</td><td>4</td><td>5</td><td>6</td><td>6</td></tr><tr><td><strong>8</strong></td><td>2</td><td>2</td><td>2</td><td>2</td><td>2</td><td>2</td><td>3</td><td>4</td><td>5</td><td>6</td></tr><tr><td><strong>9</strong></td><td>2</td><td>2</td><td>2</td><td>2</td><td>2</td><td>2</td><td>2</td><td>3</td><td>4</td><td>5</td></tr><tr><td><strong>10</strong></td><td>2</td><td>2</td><td>2</td><td>2</td><td>2</td><td>2</td><td>2</td><td>2</td><td>3</td><td>4</td></tr></tbody></table><h3 id="critical-hits">critical hits</h3><h2 id="armour">armour</h2><p>Steel breastplates, chainmail, leather tunics, shields…
all these and more are readily available in the forges
of the villages surrounding Mordheim. That is if you
are prepared to pay the price, since armour is very
expensive.</p><p>If a warrior wearing armour suffers a wound roll a D6.
If the dice roll is sufficiently high the wounding hit
has bounced off the armour and has not hurt the
wearer at all. The dice score required varies according
to the type of armour.</p><p>The table below summarises the most common
armour types and the D6 rolls required to make a
save. Note that carrying a shield increases the save by
+1. For example, a warrior in light armour with a
shield will save on a roll of a 5 or 6. A warrior who has
a shield but no armour will save on a roll of a 6.</p><table class="rules-table"><thead><tr><th>Armour</th><th>Minimum D6 score required to save</th></tr></thead><tbody><tr><td>Light armour</td><td>6</td></tr><tr><td>Heavy armour</td><td>5</td></tr><tr><td>Gromril armour</td><td>4</td></tr><tr><td>Shield</td><td>adds +1 to the armour save</td></tr></tbody></table><h3 id="armour-save-modifiers">armour save modifiers</h3><p>Some weapons are better at penetrating armour than
others. A shot from a short bow can be deflected
relatively easily, but a shot from a crossbow penetrates
armour much more effectively.</p><p>The higher a weapon’s Strength, the more easily it can
pierce armour. The chart below shows the reduction
to the enemy’s armour saving throw for different
Strength weapons.</p><table class="rules-table"><thead><tr><th>Strength</th><th>Save modifier</th></tr></thead><tbody><tr><td>1-3</td><td>None</td></tr><tr><td>4</td><td>-1</td></tr><tr><td>5</td><td>-2</td></tr><tr><td>6</td><td>-3</td></tr><tr><td>7</td><td>-4</td></tr><tr><td>8</td><td>-5</td></tr><tr><td>9+</td><td>-6</td></tr></tbody></table><p>Some weapons are better at penetrating
armour than their Strength value suggests
(Elven bows, for example). This is covered in
the entry for each particular weapon (see the
<a href="https://www.mordheimer.net/docs/weapons-armour">Weapons &amp; Armour section</a>).</p><p><em><strong>Example:</strong> Dieter wears heavy armour and
carries a shield. His armour save is 4+. He is
hit by a crossbow (Strength 4) and therefore he
will save on a D6 roll of 5+ (ie, 4+–1=5+).</em></p><h3 id="ward-saves">WARD SAVES</h3><p>Some troops types and creatures are protected by more than mere physical armour. They may be shielded by magical charms or blessings, given protection by the gods of the Warhammer world, or perhaps they are just astoundingly lucky.</p><p>Models with this sort of protection are referred to as having a Ward save or Ward. This type of save is quite different from an armour save and it is very important to understand the difference from the beginning.</p><p>Wards represent magical or divine protection which can save a warrior when armour would be of no use at all. Unlike an armour save, a Ward is never modified by Strength modifiers, etc. Even if a hit ignores all armour saves, a model with a Ward may still try to take its Ward save as normal. A model may only ever take one Ward save against each wound it has suffered.</p><p>Sometimes a model has both an armour save and a Ward save. In this case, the model must take the armour save first and, if it is failed, the model is allowed to try to make a Ward save. No model can ever try to make more than one Ward save against a wound it has suffered. If a model has two Ward saves for any reason, use the better Ward save.</p><div class="rules-callout"><div class="rules-callout__title">ward</div><div class="rules-callout__body"><p>The above is copied from the 6th edition Warhammer Fantasy rulebook. Mordheim was released during 5th edition and did not include ward saves. Later warbands however, were released during 6th edition and referred to special saves as Ward saves.</p></div></div><h2 id="injuries">injuries</h2><p>Most warriors have a Wounds characteristic of 1, but
some have a value of 2 or more. If the target has more
than 1 wound then deduct 1 from his total each time
he suffers a wound. Make a note on the roster sheet.
So long as the model has at least 1 wound remaining
he may continue to fight.</p><p>As soon as a fighter’s Wounds are reduced to zero,
roll to determine the extent of his injuries. The player
who inflicted the wound rolls a D6 for the wound
that reduced the model to zero wounds and for every
wound the model receives after that. If a model
suffers several wounds in one turn, roll once for each
of them and apply the highest result.</p><table class="rules-table"><thead><tr><th>D6</th><th>Result</th></tr></thead><tbody><tr><td>1-2</td><td><strong>Knocked down.</strong> The force of the blow knocks the warrior down. Place the model face up to show that he has been knocked down.</td></tr><tr><td>3-4</td><td><strong>Stunned.</strong> The target falls to the ground where he lies wounded and barely conscious. Turn the model face down to show that he has been stunned.</td></tr><tr><td>5-6</td><td><strong>Out of action.</strong> The target has been badly hurt and falls to the ground unconscious. He takes no further part in the game and is immediately removed from the battle.</td></tr></tbody></table><h3 id="knocked-down">knocked down</h3><p>A fighter who has been knocked down falls to the
ground either because of a jarring blow he has
sustained, because he has slipped, or because
he has thrown himself to the ground to avoid injury.
Turn the model face up to show that
he has been knocked down. Knocked down models
may crawl 2&quot; during the movement
phase, but may not fight in hand-to-hand
combat, shoot or cast spells. If he is in base-to-base contact with an enemy, a knocked
down model can crawl 2&quot; away only if the
enemy is engaged in hand-to-hand combat
with another opponent, otherwise he has to
stay where he is. In combat he cannot strike
back and the enemy will have a good chance
of putting him out of action (see the <a href="https://www.mordheimer.net/docs/rules/close-combat#warriors-knocked-down">Warriors Knocked Down section</a> of the Close Combat rules).</p><p>A warrior who has been knocked down may
stand up at the start of his next turn. In that
turn he may move at half rate, shoot and cast spells, he cannot charge or run. If he is engaged in
hand-to-hand combat, he may not move away and will
automatically strike last, irrespective of weapons or
Initiative. After this turn the fighter moves and fights
normally, even though he has zero wounds left. If the
model takes any further wounds, then roll for injury
once more, exactly as if the model had just sustained
its last wound.</p><h3 id="stunned">stunned</h3><p>When a warrior is stunned, he is either badly injured
or temporarily knocked out. Turn the model face
down to show that he has been stunned. A fighter
who is stunned may do nothing at all. A player may
turn the model face up in the next recovery phase,
and the warrior is then treated as knocked down.</p><h3 id="out-of-action">out of action</h3><p>A warrior who is out of action is also out of the game.
Remove the model from the tabletop. It’s impossible
to tell at this point whether the warrior is alive or
dead, but for game purposes it makes no difference at
this stage. After the battle you can test to see whether
he survives and if he sustains
any serious lasting injuries as a
result of his wounds (see <a href="https://www.mordheimer.net/docs/rules/close-combat#warriors-knocked-down">Serious Injuries</a> for details).</p>
    `,
  },
  {
    id: "close-combat",
    label: "Close Combat",
    content: `
<h2 id="who-can-fight">who can fight</h2><p>Models whose bases are touching are engaged in
hand-to-hand combat. This can only happen once a
warrior has charged his enemy, as models are
otherwise not allowed to move into contact.</p><p>All close quarter fighting is worked out in the hand-to-hand combat phase. Regardless of whose turn it is, all
models in hand-to-hand combat will fight. A warrior
can fight against enemies to his side, front, or rear. In
reality the fighters are constantly moving, dodging,
and weaving as they struggle to kill their adversaries.</p><p>Models fighting in hand-to-hand combat do not shoot
in the shooting phase. They are far too busy fighting
for their lives. Any very close range shots they are able
to make using pistols are treated like close combat
weapon attacks (see the <a href="https://www.mordheimer.net/docs/weapons-armour">Weapons &amp; Armour section</a>).</p><h2 id="who-strikes-first">who strikes first</h2><p>Normally, models fight in order of descending Initiative with the highest striking first. If their Initiatives are equal, roll a dice to see who strikes first.</p><p>If a model stood up in the Recovery phase of that turn, then he will strike last irrespective of any other circumstances.</p><p>Sometimes a model will be allowed to ‘strike first’ for
some reason. Most commonly this is because they
charged in that turn, but some equipment, skills and
spells produce the same effect. If only one model
‘strikes first’ then it does so and the remainder of the
combatants strike in Initiative order as described
above.</p><p>If there are several models who are each entitled to
‘strike first’, then they determine the order of combat
between themselves by Initiative, as described above.
Once all those that were eligible to ‘strike first’ have
fought, any other combatants fight in Initiative order. </p><h2 id="which-models-fight">which models fight</h2><p>A model can fight if its base is touching the base of an
enemy model. Even models attacked from the side or
rear can fight.</p><p>If a warrior is touching more than one enemy, he can
choose which to attack. If he has more than 1 Attack,
he can divide them in any way the player wishes, so
long as he makes this clear before rolling to hit.</p><h2 id="hitting-the-enemy">hitting the enemy</h2><p>To determine whether hits are scored, roll
a D6 for each model fighting. If a model has
more than 1 Attack roll a D6 for each attack.</p><p>The dice roll needed to score a hit on your enemy
depends upon the Weapon Skills of the attacker and
the foe. Compare the Weapon Skill of the attacker
with that of his opponent and consult the To Hit chart
below to find the minimum D6 score needed to hit.</p><p><img decoding="async" loading="lazy" src="https://www.mordheimer.net/assets/images/hit-chart-7d44c24d55829a71831e2e14bf766518.jpg" width="1116" height="745"></p><h2 id="fighting-with-two-weapons">fighting with two weapons</h2><p>Some maniac warriors carry two weapons, one in
each hand, so they can rain a flurry of blows on their
enemies. A warrior armed with two one-handed
weapons may make 1 extra Attack with the additional
weapon. Note that this is added to the total of the
warrior’s attacks after other modifiers, such as ,
have been applied. If he is armed with two different
weapons (sword and dagger, for example), he will
make a single attack with whichever weapon he
chooses, and all others with the remaining weapon.
Roll to hit and wound for each weapon separately.</p><h2 id="weapon-modifiers">weapon modifiers</h2><p>Unlike hits from shooting, the Strength of the attacker
is used to determine wounds, rather than that of the
weapon itself. However, some weapons confer a
bonus on the attacker’s Strength (see the <a href="https://www.mordheimer.net/docs/weapons-armour/close-combat">Weapons &amp; Armour section</a> for full details).</p><h2 id="roll-to-wound">roll to wound</h2><p>Once your model
has hit a target you
must test to see
whether a wound is
inflicted. Sometimes a
strike may fail to wound
simply because it causes
an insignificant injury or
glances off the enemy’s
equipment.</p><p>To determine whether the blow
has caused a wound compare the
Strength of the weapon with the
Toughness of the target. You will find a
complete description of the various
weapons together with their Strength
values and special rules in the <a href="https://www.mordheimer.net/docs/weapons-armour/close-combat">Weapons &amp; Armour section</a>.</p><p>Follow the <a href="https://www.mordheimer.net/docs/rules/wounds-and-injuries">same procedure</a> for wounding as in the Shooting section. Note that a
dash (–) means that there is no chance of wounding
the target.</p><p><img decoding="async" loading="lazy" src="https://www.mordheimer.net/assets/images/wound-chart-cc-c27d2faead1a331884236ca22271562f.jpg" width="1116" height="645"></p><h2 id="armour">armour</h2><p>Combatants that are wounded have the chance to
avoid damage if they are wearing armour or carrying
shields. This is exactly the same as described for
shooting, and the same rules apply.</p><p>For each wound suffered the player rolls a D6. If he
rolls greater than or equal to the armour save of his
fighter then that wound has been absorbed or
deflected by the armour.</p><h2 id="armour-save-modifiers">armour save modifiers</h2><p>Some models are so powerful that armour provides
less protection against them.</p><p>The higher a creature’s Strength the more easily it can
pierce armour. The following chart shows the
reduction in the enemy’s armour saving throw caused
by the attacker’s Strength.</p><table class="rules-table"><thead><tr><th>Strength</th><th>Save modifier</th></tr></thead><tbody><tr><td>1-3</td><td>None</td></tr><tr><td>4</td><td>-1</td></tr><tr><td>5</td><td>-2</td></tr><tr><td>6</td><td>-3</td></tr><tr><td>7</td><td>-4</td></tr><tr><td>8</td><td>-5</td></tr><tr><td>9+</td><td>-6</td></tr></tbody></table><p>Some weapons also confer a bonus to the user’s
Strength, making it more likely that any hits will
pierce the opponent’s armour. These bonuses are
given in the <a href="https://www.mordheimer.net/docs/weapons-armour/close-combat">Weapons &amp; Armour section</a>.</p><h2 id="parry">parry</h2><p>Bucklers are small shields which offer no increase to
the armour saving throw, but allow you to parry
attacks. Swords are also used to parry enemy attacks.</p><p>When an opponent scores a hit, warriors equipped
with bucklers or swords may try to parry the blow.</p><p>Roll a D6. If the score is higher than the number your
opponent rolled to hit, the buckler or sword has
parried the strike. Note that it is therefore impossible
to parry a blow which scored a 6 on the roll to hit.</p><p>A buckler or sword may only parry one blow per
hand-to-hand combat phase. A parried blow is
ignored and has no effect. If your opponent scored
several hits, you will have to try to beat the highest
score (if the highest score is a 6, you automatically
lose the chance of parrying that opponent’s attacks).
If a model is fighting against several opponents, it may
only parry the strike from the enemy who makes the
first hit(s) (ie, the attacking model with the highest
Initiative). In the case of equal Initiative
characteristics roll a dice to decide who strikes first.</p><p>If your model is armed with a buckler and a sword,
you may re-roll any failed parries once. A model
armed with two swords can still only roll once.</p><p>A model may not parry attacks made with twice (or
more) his own basic Strength – they are simply too
powerful to be stopped.</p><h2 id="warriors-knocked-down">warriors knocked down</h2><p>If an enemy is fighting a warrior who is knocked
down, he may attack him to put him out of his misery.
All attacks against a warrior who is knocked down hit
automatically. If any of the attacks wound the knocked
down model and he fails his armour save, he is
automatically taken out of action as explained
previously. A knocked down model may not parry.</p><h2 id="warriors-stunned">warriors stunned</h2><p>A stunned warrior is at the mercy of his enemies. A
stunned model is automatically taken out of action if
an enemy can attack him in hand-to-hand combat.</p><h2 id="attacking-stunned-and-knocked-down-warriors">attacking stunned and knocked down warriors</h2><p>Note that a model with multiple attacks may not
stun/knock down and then automatically take a
warrior out of action during the same hand-to-hand
combat phase. The only way you can achieve this is to
have more than one of your models attacking the
same enemy. So, if the enemy is stunned/knocked
down by the first warrior, he can be hit and put out of
action by the next warrior to attack.</p><p>If your model is engaged in close combat with an
enemy who is still standing, he cannot attack any
other models that are stunned or knocked down,
since in reality they will not pose an immediate threat
to him and their companions will try to protect them.</p><h2 id="moving-from-combat">moving from combat</h2><p>Once models are engaged in hand-to-hand combat
they cannot move away during their movement
phase. They must fight until they are either taken out
of action, until they take out their enemies, or until
one or the other breaks and runs.</p><p>The exception to this rule is that if all a model’s close
combat opponents are knocked down or stunned, he
may move away from the combat if you wish, and
even charge other enemies within range.</p><h2 id="breaking-from-combat">breaking from combat</h2><p>A warrior who panics whilst fighting in hand-to-hand
combat will break off and make a run for it as
described in the Leadership &amp; Psychology section.</p><p>When a fighter breaks from combat he simply turns
and runs off. His opponents automatically hit
the warrior as he breaks, each
inflicting 1 hit which is
worked out immediately.</p><p>Note that warriors
cannot choose to
leave a fight
voluntarily.</p>
    `,
  },
  {
    id: "wounds-and-injuries",
    label: "Wounds & Injuries",
    content: `
<h2 id="roll-to-wound">roll to wound</h2><p>Once you have hit a target test to see if a wound is
inflicted. A shot may fail to cause a wound because it
hits part of the target’s equipment, just scratches the
skin or causes some very minor injury which the
warrior bravely (or stupidly) ignores. If you fail to
cause a wound, the target is unharmed.</p><p>To determine whether your shot has caused a wound,
compare the Strength of the weapon with the
Toughness of the target. You will find a complete
description of the various weapons together with
their Strength values and special rules in the <a href="https://www.mordheimer.net/docs/weapons-armour">Weapons &amp; Armour section</a>.</p><p>The chart below shows the D6 score required to turn
a hit into a wound Note that a dash (–) means that
there is no chance of wounding the target.</p><p><img decoding="async" loading="lazy" src="https://www.mordheimer.net/assets/images/wound-chart-a92e853211e30e1a862a83aff0d1dd94.jpg" width="1151" height="649"></p><h2 id="critical-hits">critical hits</h2><h2 id="armour">armour</h2><p>Steel breastplates, chainmail, leather tunics, shields…
all these and more are readily available in the forges
of the villages surrounding Mordheim. That is if you
are prepared to pay the price, since armour is very
expensive.</p><p>If a warrior wearing armour suffers a wound roll a D6.
If the dice roll is sufficiently high the wounding hit
has bounced off the armour and has not hurt the
wearer at all. The dice score required varies according
to the type of armour.</p><p>The table below summarises the most common
armour types and the D6 rolls required to make a
save. Note that carrying a shield increases the save by
+1. For example, a warrior in light armour with a
shield will save on a roll of a 5 or 6. A warrior who has
a shield but no armour will save on a roll of a 6.</p><table class="rules-table"><thead><tr><th>Armour</th><th>Minimum D6 score required to save</th></tr></thead><tbody><tr><td>Light armour</td><td>6</td></tr><tr><td>Heavy armour</td><td>5</td></tr><tr><td>Gromril armour</td><td>4</td></tr><tr><td>Shield</td><td>adds +1 to the armour save</td></tr></tbody></table><h2 id="armour-save-modifiers">armour save modifiers</h2><p>Some weapons are better at penetrating armour than
others. A shot from a short bow can be deflected
relatively easily, but a shot from a crossbow penetrates
armour much more effectively.</p><p>The higher a weapon’s Strength, the more easily it can
pierce armour. The chart below shows the reduction
to the enemy’s armour saving throw for different
Strength weapons.</p><table class="rules-table"><thead><tr><th>Strength</th><th>Save modifier</th></tr></thead><tbody><tr><td>1-3</td><td>None</td></tr><tr><td>4</td><td>-1</td></tr><tr><td>5</td><td>-2</td></tr><tr><td>6</td><td>-3</td></tr><tr><td>7</td><td>-4</td></tr><tr><td>8</td><td>-5</td></tr><tr><td>9+</td><td>-6</td></tr></tbody></table><p>Some weapons are better at penetrating
armour than their Strength value suggests
(Elven bows, for example). This is covered in
the entry for each particular weapon (see the <a href="https://www.mordheimer.net/docs/weapons-armour">Weapons &amp; Armour section</a>).</p><p><em><strong>Example:</strong> Dieter wears heavy armour and
carries a shield. His armour save is 4+. He is
hit by a crossbow (Strength 4) and therefore he
will save on a D6 roll of 5+ (ie, 4+–1=5+).</em></p><h2 id="injuries">injuries</h2><p>Most warriors have a Wounds characteristic of 1, but
some have a value of 2 or more. If the target has more
than 1 wound then deduct 1 from his total each time
he suffers a wound. Make a note on the roster sheet.
So long as the model has at least 1 wound remaining
he may continue to fight.</p><p>As soon as a fighter’s Wounds are reduced to zero,
roll to determine the extent of his injuries. The player
who inflicted the wound rolls a D6 for the wound
that reduced the model to zero wounds and for every
wound the model receives after that. If a model
suffers several wounds in one turn, roll once for each
of them and apply the highest result.</p><table class="rules-table"><thead><tr><th>D6</th><th>Result</th></tr></thead><tbody><tr><td>1-2</td><td><strong>Knocked down.</strong> The force of the blow knocks the warrior down. Place the model face up to show that he has been knocked down.</td></tr><tr><td>3-4</td><td><strong>Stunned.</strong> The target falls to the ground where he lies wounded and barely conscious. Turn the model face down to show that he has been stunned.</td></tr><tr><td>5-6</td><td><strong>Out of action.</strong> The target has been badly hurt and falls to the ground unconscious. He takes no further part in the game and is immediately removed from the battle.</td></tr></tbody></table><h2 id="knocked-down">knocked down</h2><p>A fighter who has been knocked down falls to the
ground either because of a jarring blow he has
sustained, because he has slipped, or because
he has thrown himself to the ground to avoid injury.
Turn the model face up to show that
he has been knocked down. Knocked down models
may crawl 2&quot; during the movement
phase, but may not fight in hand-to-hand
combat, shoot or cast spells. If he is in base-to-base contact with an enemy, a knocked
down model can crawl 2&quot; away only if the
enemy is engaged in hand-to-hand combat
with another opponent, otherwise he has to
stay where he is. In combat he cannot strike
back and the enemy will have a good chance
of putting him out of action (see the <a href="https://www.mordheimer.net/docs/rules/close-combat#warriors-knocked-down">Warriors Knocked Down section</a> of the Close Combat rules).</p><p>A warrior who has been knocked down may
stand up at the start of his next turn. In that
turn he may move at half rate, shoot and cast spells, he cannot charge or run. If he is engaged in
hand-to-hand combat, he may not move away and will
automatically strike last, irrespective of weapons or
Initiative. After this turn the fighter moves and fights
normally, even though he has zero wounds left. If the
model takes any further wounds, then roll for injury
once more, exactly as if the model had just sustained
its last wound.</p><h2 id="stunned">stunned</h2><p>When a warrior is stunned, he is either badly injured
or temporarily knocked out. Turn the model face
down to show that he has been stunned. A fighter
who is stunned may do nothing at all. A player may
turn the model face up in the next recovery phase,
and the warrior is then treated as knocked down.</p><h2 id="out-of-action">out of action</h2><p>A warrior who is out of action is also out of the game.
Remove the model from the tabletop. It’s impossible
to tell at this point whether the warrior is alive or
dead, but for game purposes it makes no difference at
this stage. After the battle you can test to see whether
he survives and if he sustains
any serious lasting injuries as a
result of his wounds (see <a href="https://www.mordheimer.net/docs/campaigns#serious-injuries">Serious Injuries</a> for details).</p>
    `,
  },
  {
    id: "leadership-psychology",
    label: "Leadership & Psychology",
    content: `
<h2 id="the-rout-test">the rout test</h2><p>A player must make a Rout test at the start of his turn
if a quarter (25%) or more of his warband is out of
action. For example, in a warband that has twelve
warriors a test is needed if three or more are out of
action. Even warbands who are normally immune to
psychology (such as Undead) must make Rout tests.</p><p>If the Rout test is failed, the warband automatically
loses the fight. The game ends immediately and
surviving warriors retreat from the area. A failed Rout
test is the most common way in which a fight ends.</p><p>To take a Rout test roll 2D6. If the score is equal to or
less than the warband leader’s Leadership, the player
has passed the test and may continue to fight.</p><p>If the warband’s leader is out of action or stunned,
then the player may not use his Leadership to take the
test. Instead, use the highest Leadership characteristic amongst any remaining fighters who are not stunned
or out of action.</p><h3 id="voluntary-rout">voluntary rout</h3><p>A player may choose to voluntarily Rout at the start of
any of his own turns if he wishes, but only if he was
already required to take a Rout test or if a quarter
(25%) or more of his warband are out of action.</p><h3 id="leaders">leaders</h3><p>A warrior within 6&quot; of his leader may use his leader’s
Leadership value when taking Leadership tests. This
represents the leader’s ability to encourage his
warriors and push them beyond normal limits.</p><p>A leader cannot confer this bonus if he is knocked
down, stunned or fleeing himself. The sight of your
leader running for cover is obviously far from
encouraging!</p><h2 id="all-alone">all alone</h2><p>Being outnumbered and alone is a nerve-racking
situation for any warrior.</p><p>If your warrior is fighting alone against two or
more opponents, and there are no friendly
models within 6&quot; (knocked down, stunned or
fleeing friends do not count), he must make a test
at the end of his combat phase. The test is taken
against the model’s Leadership on 2D6. If the
warrior scores equal to or under his Leadership
his nerve holds. If the score is greater than his
Leadership, the warrior breaks from combat and
runs. Each one of his opponents may make one
automatic hit against him as he turns to run. If
the model survives, he runs 2D6&quot; directly away
from his enemies.</p><p>At the start of each of his turns, the warrior must
take another Leadership test. If he passes, he
stops but can do nothing else during his own
turn except cast spells. If he fails or is charged, he
runs 2D6&quot; towards the nearest table edge,
avoiding any enemy models. If he reaches the
table edge before he has managed to recover his
nerves, he is removed from combat.</p><p>If a warrior is charged while he is fleeing, the
charger is moved into base contact as normal, but
the fleeing warrior will then run a further 2D6&quot;
towards the table edge, before any blows can be
struck.</p><h2 id="fear">fear</h2><p>Fear is a natural reaction to huge or unnerving
creatures. A model must take a <a href="https://www.mordheimer.net/docs/rules/leadership-psychology#fear">fear</a> test (ie, test
against his Leadership) in the following situations.
Note that creatures that cause fear can ignore these
tests.</p><p><strong>a) If the model is charged by a warrior or a creature which causes <em>fear</em>.</strong></p><p>If a warrior is charged by an enemy that he fears
then he must take a test to overcome that fear.
Test when the charge is declared and is
determined to be within range. If the test is
passed the model may fight as normal. If it is
failed, the model must roll 6s to score hits in
that round of combat.</p><p><strong>b) If the model wishes to charge a <em>fear</em>-causing enemy.</strong></p><p>If a warrior wishes to charge an enemy that it
fears then it must take a test to overcome this. If
it fails the model may not charge and must
remain stationary for the turn. Treat this as a
failed charge.</p><h2 id="frenzy">frenzy</h2><p>Some warriors can work themselves into a berserk
state of fury, a whirlwind of destruction in which all
concern for their own personal safety is ignored in
favour of mindless violence. These warriors are
described as being frenzied.</p><p>Frenzied models must always charge if there are any
enemy models within charge range (check after
charges have been declared). The player has no
choice in this matter – the warrior will automatically
declare a charge.</p><p>Frenzied warriors fight with double their Attacks
characteristic in hand-to-hand combat. Warriors with
1 Attack therefore have 2 Attacks, warriors with 2
Attacks have 4, etc. If a warrior is carrying a weapon in
each hand, he receives +1 Attack for this as normal.
This extra Attack is not doubled.</p><p>Once they are within charge range, frenzied warriors
are immune to all other psychology, such as <a href="https://www.mordheimer.net/docs/rules/leadership-psychology#fear">fear</a> and
don’t have to take these tests as long as they remain
within charge range.</p><p>If a frenzied model is knocked down or stunned, he is
no longer frenzied. He continues to fight as normal
for the rest of the battle.</p><h2 id="hatred">hatred</h2><p>Hatred is a very powerful emotion, and during this
era of strife and war, bitter rivalry is commonplace.</p><p>Warriors who fight enemies they hate in hand-to-hand
combat may re-roll any misses when they attack in the
first turn of each hand-to-hand combat. This bonus
applies only in the first turn of each combat and
represents the warrior venting his pent-up hatred on
his foe. After the initial round of hand-to-hand combat
he loses some impetus and subsequently fights
as normal for the rest of the combat.</p><h2 id="stupidity">stupidity</h2><p>Many large and powerful creatures, as well as some of
the more unhinged individuals in Mordheim, are
unfortunately rather stupid.</p><p>Models that are stupid test at the start of their turn to
see if they overcome their stupidity. Make a test for
each model affected by stupidity. If you pass the test
by rolling their Leadership value or less on 2D6 then
all is well – the creatures behave reasonably
intelligently and the player may move and fight with
them as normal.</p><p>If the test is failed all is not well. Until the start of his
next turn (when it takes a new Stupidity test) the
model will not cast spells or fight in hand-to-hand
combat (though his opponent will still have to roll to
hit him as normal).</p><p>If a model who fails a Stupidity test is not in hand-to-hand combat, roll a D6.</p><table class="rules-table"><thead><tr><th>D6</th><th>Result</th></tr></thead><tbody><tr><td>1-3</td><td>The warrior moves directly forward at half speed in a shambling manner. He will not charge an enemy (stop his movement 1&quot; away from any enemy he would have come into contact with). He can fall down from the edge of a sheer drop (see the Falling rules) or hit an obstacle, in which case he stops. The model will not shoot this turn.</td></tr><tr><td>4-6</td><td>The warrior stands inactive and drools a bit during this turn. He may do nothing else, as drooling is <em>so</em> demanding.</td></tr></tbody></table><p>Regardless of whether the test is passed or failed, the result applies until the start of the model’s following turn (when it takes a new Stupidity test).</p><h2 id="animosity">Animosity</h2><p>Orcs and Goblins enjoy nothing more than a good scrap, unfortunately they’re not always very discerning about who they scrap with! To represent this, at the start of the Orc player’s turn, roll a D6 for each Henchman who is either an Orc or a Goblin. A roll of 1 means that the warrior has taken offense to something one of his mates has done or said. Do not roll for models that are engaged in hand-to-hand combat (they’re already scrappin’!). To find out just how offended the model is, roll another D6 and consult the following chart to see what happens:</p><table class="rules-table"><thead><tr><th style="text-align:center">D6</th><th>Result</th></tr></thead><tbody><tr><td style="text-align:center"><strong>1</strong></td><td><strong>“I ’Erd Dat!”</strong><br><em>The warrior decides that the nearest friendly Orc or Goblin Henchman has insulted his lineage or personal hygiene and must pay the price!</em><br>    If there is a friendly Orc or Goblin Henchman or Hired Sword within charge reach (if there are multiple targets within reach, choose the one nearest to the mad model), the offended warrior will immediately charge and fight a round of hand-to-hand combat against the source of his ire. At the end of this round of combat, the models will immediately move 1&quot; apart and no longer count as being in close combat (unless one of them fails another Animosity test and rolls this result again). <br>    If there are no friendly Orc or Goblin Henchmen or Hired Swords within charge reach, and the warrior is armed with a missile weapon, he immediately takes a shot at the nearest friendly Orc or Goblin Henchman or Hired Sword. If none of the above applies, or if the nearest friendly model is an Orc Hero, the warrior behaves as if a 2-5 had been rolled on this chart. In any case, the warrior in question may take no other action this turn, though he may defend himself if attacked in hand-to-hand combat.</td></tr><tr><td style="text-align:center"><strong>2-5</strong></td><td><strong>“Wud Yoo Say?”</strong><br><em>The warrior is fairly certain he heard an offensive sound from the nearest friendly Orc or Goblin, but he’s not quite sure. He spends the turn hurling insults at his mate.</em><br>    He may do nothing else this turn, though he may defend himself if attacked in hand-to-hand combat.</td></tr><tr><td style="text-align:center"><strong>6</strong></td><td><strong>“I’ll Show Yer!”</strong><br><em>The warrior imagines that his mates are laughing about him behind his back and calling him silly names. To show them up he decides that he’ll be the first one to the scrap!</em><br>    This model must move as quickly as possible towards the nearest enemy model, charging into combat if possible. If there are no enemy models within sight, the Orc or Goblin warrior may make a normal move immediately. This move is in addition to his regular move in the Movement phase, so he may therefore move twice in a single turn if you wish. <br>    If the extra move takes the Orc or Goblin warrior within charge reach of an enemy model, the warrior must charge into close combat during his regular movement.</td></tr></tbody></table>
    `,
  },
] as const;

export type RulesTab = (typeof rulesTabs)[number];
