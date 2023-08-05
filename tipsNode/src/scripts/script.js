const COMISSION_PERCENT = 0.05;
const COMPANY_LOGO_URL = 'https://sun1-23.userapi.com/AMRzSyPgEmDTGxBS2NS2q3OtocpKrVCeWIBzHA/iDhbcrxZNDc.jpg?ava=1';
const EMPLOYEE_AVATAR_URL = 'https://s3-alpha-sig.figma.com/img/a26b/1455/79c4759239487b58b92e5c54e82dec59?Expires=1648425600&Signature=d7j8CsLFQ-SEYs3c3wSFAMaY644lH6U6YfTQk7CAgCamdw846um8nht8L5rbApwcWhfxeMZGvSU2i1gBGuHJAXoGVdgPk4hCJMXcYqiUjyU4f9bKcH2wEjMSbhb4iLQNW~o0M6pJb~wa4B4yMwhGvkMURoyiOXqSnIExDmgM8BPoaHzypG7ntPOupRS1OEc4QlLcOunhpaMEn4zcIb8zki74c1mw2cmIgp1kg~4sedI905zoqxyFX7ItSlTq9jI3Gu0ZciDQRrESLNMl0ANEuK2Fo86htjPoHZI62v5yCGaIkfmULvyOATyt-ZqLtDb~wnCHjVWo8rQtBb0v7LUCfw__&Key-Pair-Id=APKAINTVSUGEWH5XD5UA'
    'https://sun9-88.userapi.com/impf/ICTO9JIaPMmmNyo72hAggilHYNKBdCg9n8QycQ/DIp-hZqTJ3g.jpg?size=762x1080&quality=96&sign=2b1a52ee5467368febe46c9813f052ad&type=album';
const EMPLOYEE_NAME = 'Mansour';
const EMPLOYEE_DREAM = 'When my hungry son cries “I want to eat”, I always answer: “Today was not enough tips”';
const DEFAULT_TIPS_AMOUNTS = [5, 10, 15, 20];
const ONLY_PERFECT_IS_GOOD = false;
const COMPLIMENTS = [
    {
        title: 'Polite',
        icon: './images/polite.svg',
    },
    {
        title: 'Excellent',
        icon: './images/delicious.svg',
    },
    {
        title: 'Punctual',
        icon: './images/punctual.svg',
    },
];

window.addEventListener('DOMContentLoaded', () => {
    const $employeeAvatar = document.querySelectorAll('.imgEmployee');
    const $employeeFirstName = document.querySelector('#employeeFirstName');
    const $emloyeeDream = document.querySelector('#dreamsAboutContent')
    const $tipInputOut = document.querySelector('#amountInput');
    const $hiddenTipAmountLabel = document.querySelector('#firstNumber');
    const $AED = document.querySelector('#secondNumber');
    const $predefinedTipsButtons = document.querySelector('#predefinedTipsButtons');
    const $payComissionYourselfCheckbox = document.querySelector('#payComissionYourselfCheckbox');
    const $spanComissionValue = document.querySelector('#comission');
    const $divFeatures = document.querySelector('#divFeatures');
    const $payService = document.querySelector('#payService');
    const $star = document.querySelectorAll('.star');
    const $card = document.querySelector('#card');
    const $main  = document.querySelector('.main');
    const $positive = document.querySelector('.positiveContent');
    const $negative = document.querySelector('.negativeContent');
    console.log([...$star]);
    $employeeAvatar.forEach(element => {
        element.src = EMPLOYEE_AVATAR_URL;
    });
    $employeeFirstName.innerText = EMPLOYEE_NAME;
    $emloyeeDream.innerText = EMPLOYEE_DREAM;

    // tip amount with comission
    let tipValue = 0;
    let comissionValue = 0;
    const tipsAmounts = DEFAULT_TIPS_AMOUNTS.slice();

    // array with images and texts of compliments
    const arrCompliments = COMPLIMENTS.map(comp => ({
        textFirst: comp.title,
        imgLink: comp.icon,
        selected: false,
    }));

    function buildElement(tag, className, text) {
        const el = document.createElement(tag);
        el.classList.add(...className.split(' '));
        if (text) {
            el.innerText = text;
        }
        return el;
    }

    function updateHiddenTipLabel() {
        if ($tipInputOut.value) {
            $hiddenTipAmountLabel.innerText = $tipInputOut.value;
            $AED.classList.add('AEDvisible');
            $tipInputOut.classList.remove('empty');
            tipValue = $tipInputOut.value;
        } else {
            $hiddenTipAmountLabel.value = '';
            $tipInputOut.classList.add('empty');
            $AED.classList.remove('AEDvisible');
            tipValue = 0;
        }
    }

    // AED Label
    $tipInputOut.addEventListener('input', () => {
        updateHiddenTipLabel();
        calculateComission();
    });

    const setPredefinedTipValue = newPrice => {
        $tipInputOut.value = newPrice;
        updateHiddenTipLabel();
        calculateComission();
    };

    tipsAmounts.forEach(elem => {
        const numberSpan = buildElement('span','tipSize',elem)
        const AEDspan = buildElement('span','firstNumber',' AED')
        const button = buildElement('button', 'AEDbutton');
        button.addEventListener('click', setPredefinedTipValue.bind(null, elem));
        $predefinedTipsButtons.appendChild(button);
        button.appendChild(numberSpan)
        button.appendChild(AEDspan)
    });
    console.log(predefinedTipsButtons);
    let starActive = null;

    document.querySelectorAll('button.star').forEach(starButton => {
        starButton.addEventListener('click', ({ target }) => {
            if (starActive) {
                starActive.classList.remove('active');
            }
            target.classList.add('active');
            starActive = target;
        });
    });

    // Service features / compliments
    const renderButtons = () => {
        //remove all existing buttons
        $divFeatures.innerHTML = '';

        //render new buttons
        arrCompliments.forEach(elem => {
            const button = buildElement('button', elem.selected ? 'features featuresSelected' : 'features');
            const img = buildElement('img',elem.selected ? 'icon iconSelected' : 'icon');
            const spanFirst = buildElement('span',elem.selected ? 'first firstSelected' : 'first', elem.textFirst);

            img.src = elem.imgLink;

            button.appendChild(img);
            button.appendChild(spanFirst);

            button.addEventListener('click', () => {
                elem.selected = !elem.selected;
                renderButtons();
            });

            $divFeatures.appendChild(button);
        });
    };

    renderButtons();

    function calculateComission() {
        if (isNaN(tipValue) || !tipValue) {
            $payComissionYourselfCheckbox.style.display = 'none';
            comissionValue = 0;
        } else {
            tipValue = +tipValue;
            comissionValue = (tipValue * COMISSION_PERCENT).toFixed(2);
            $spanComissionValue.innerText = comissionValue;
            $payComissionYourselfCheckbox.style.display = 'block';
        }
    }

    function checkPrice() {
        if ($payService.checked) {
            fullPrice = +tipValue + +comissionValue;
        } else {
            fullPrice = tipValue;
        }
    }

    // appearance of reactions
    const RATING_TRESHOLD = ONLY_PERFECT_IS_GOOD ? 4 : 3;

    $card.addEventListener('click', () =>{
        const activeStars = [...$star].filter(s => s.classList.contains('active'))
        const activeStarRatings = activeStars.map(s => Number(s.dataset.rate))
        const rating = Math.max(0, ...activeStarRatings)
        $main.classList.add('close')
        if (rating > RATING_TRESHOLD){
            $positive.classList.add('open')
        }else{
            $negative.classList.add('open')
        }
    })
});
