import React from 'react'
import { ReferalLinksList } from '../ReferalLinksList/ReferalLinksList';
import classes from './ReferalLinks.module.css'
interface IProps {

}

const DEFAULT_LINK_LIST:ReferralCode[] = [
    {
        "id": 41,
        "code": "B1O8H7qy",
        "totalInvited": 0,
        "totalReferrals": 0,
        "totalEarned": 0.00098,
    },
    {
        "id": 42,
        "code": "n8MkMPOl",
        "totalInvited": 0,
        "totalReferrals": 0,
        "totalEarned": 0,
    },
    {
        "id": 43,
        "code": "3tmFeaGD",
        "totalInvited": 0,
        "totalReferrals": 0,
        "totalEarned": 0,
    },
    {
        "id": 44,
        "code": "emMJMGux",
        "totalInvited": 0,
        "totalReferrals": 0,
        "totalEarned": 0,
    }
];

export const ReferalLinks: React.FC<IProps> = ({}) => {

    return (
        <div className={classes.referalLinksWrapper}>
            <div className={classes.referalLinksHeader}>
                <div className={classes.referalLinksHeaderTitle}>Referal Links</div>
                <button className={classes.referalLinksHeaderButton}>Create Link  +</button>
            </div>
            <ReferalLinksList referalLinks={DEFAULT_LINK_LIST} />
        </div>
    )
}
