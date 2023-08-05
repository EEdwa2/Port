import React from 'react'
import { ReferalLinksItem } from '../ReferalLinksItem/ReferalLinksItem'
import classes from './ReferalLinks.module.css'

interface ReferalLinksListProps {
    referalLinks: ReferralCode[]
}

export const ReferalLinksList: React.FC<ReferalLinksListProps> = ({
    referalLinks
}) => {
    
    return (
        <div className={classes.referalLinksListWrapper}>
                {referalLinks.map((referalLink) => {
                return (
                    <ReferalLinksItem
                        key={referalLink.id}
                         refCode={referalLink}
                    />
                )
            })}
        </div>
    )
}
